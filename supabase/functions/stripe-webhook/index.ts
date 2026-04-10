// Stripe Webhook Handler
// Receives payment events from Stripe and creates venture transactions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

// Load secrets from environment (set via: supabase secrets set KEY=value)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://notmasemula.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Server configuration error", { status: 500 });
  }

  try {
    const body = await req.text();

    // Validate Stripe webhook signature
    if (STRIPE_WEBHOOK_SECRET) {
      const stripeSignature = req.headers.get("Stripe-Signature");
      if (!stripeSignature) {
        return new Response("Missing Stripe signature", { status: 401 });
      }

      const isValid = await validateStripeSignature(body, stripeSignature, STRIPE_WEBHOOK_SECRET);
      if (!isValid) {
        console.error("Invalid Stripe webhook signature");
        return new Response("Invalid signature", { status: 401 });
      }
    } else {
      // STRIPE_WEBHOOK_SECRET is required for security. Reject requests until configured.
      // Set it via: supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your-secret
      console.error("STRIPE_WEBHOOK_SECRET not configured — rejecting webhook");
      return new Response(
        "Webhook secret not configured. Set STRIPE_WEBHOOK_SECRET in Supabase secrets.",
        { status: 503 }
      );
    }

    const event = JSON.parse(body);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Idempotency check
    const { data: existing } = await supabase
      .from("webhook_events")
      .select("id")
      .eq("external_id", event.id)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ status: "already_processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process event
    let result = null;
    switch (event.type) {
      case "payment_intent.succeeded":
        result = await handlePaymentSucceeded(supabase, event.data.object);
        break;
      case "charge.refunded":
        result = await handleChargeRefunded(supabase, event.data.object);
        break;
      case "payment_intent.payment_failed":
        console.log(`Payment failed: ${event.data.object.id}`);
        break;
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    // Record processed event
    await supabase.from("webhook_events").insert({
      external_id: event.id,
      source: "stripe",
      event_type: event.type,
      status: "processed",
      payload: event,
      processed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ status: "processed", result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function validateStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  try {
    // Parse Stripe-Signature header: t=timestamp,v1=signature
    const parts: Record<string, string> = {};
    for (const part of signatureHeader.split(",")) {
      const [key, value] = part.split("=");
      parts[key] = value;
    }

    const timestamp = parts["t"];
    const receivedSignature = parts["v1"];

    if (!timestamp || !receivedSignature) return false;

    // Stripe uses: HMAC-SHA256(timestamp + "." + payload)
    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedPayload)
    );

    // Convert to hex (Stripe uses hex, not base64)
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return receivedSignature === expectedSignature;
  } catch {
    return false;
  }
}

async function handlePaymentSucceeded(
  supabase: ReturnType<typeof createClient>,
  paymentIntent: Record<string, unknown>
) {
  const { data: venture } = await supabase
    .from("shared_ventures")
    .select("id")
    .eq("status", "active")
    .limit(1)
    .single();

  if (!venture) {
    console.warn("No active venture for Stripe payment");
    return null;
  }

  // Stripe amounts are in cents
  const amountInRands = (paymentIntent.amount as number) / 100;
  const currency = ((paymentIntent.currency as string) ?? "zar").toUpperCase();
  const description = (paymentIntent.description as string) ?? "Stripe Payment";

  const { data: transaction, error } = await supabase
    .from("venture_transactions")
    .insert({
      venture_id: venture.id,
      type: "revenue",
      category: "stripe_payment",
      description: `Stripe: ${description}`,
      amount: amountInRands,
      currency,
      source: "stripe",
      external_id: paymentIntent.id as string,
      approval_status: "pending",
      transaction_date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create Stripe transaction: ${error.message}`);

  console.log(`✅ Created Stripe transaction: ${transaction.id} for ${currency} ${amountInRands}`);
  return transaction;
}

async function handleChargeRefunded(
  supabase: ReturnType<typeof createClient>,
  charge: Record<string, unknown>
) {
  const { data: venture } = await supabase
    .from("shared_ventures")
    .select("id")
    .eq("status", "active")
    .limit(1)
    .single();

  if (!venture) return null;

  const refundAmount = (charge.amount_refunded as number) / 100;

  const { data: transaction, error } = await supabase
    .from("venture_transactions")
    .insert({
      venture_id: venture.id,
      type: "refund",
      category: "stripe_refund",
      description: `Stripe Refund — ${charge.id}`,
      amount: -Math.abs(refundAmount),
      source: "stripe",
      external_id: charge.id as string,
      approval_status: "pending",
      transaction_date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create Stripe refund: ${error.message}`);
  return transaction;
}
