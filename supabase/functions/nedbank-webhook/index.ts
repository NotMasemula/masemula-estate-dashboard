// Nedbank Webhook Handler
// Receives payment status updates from Nedbank API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

// Load secrets from environment (set via: supabase secrets set KEY=value)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const NEDBANK_WEBHOOK_SECRET = Deno.env.get("NEDBANK_WEBHOOK_SECRET") ?? "";

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

    // Validate Nedbank webhook signature
    if (NEDBANK_WEBHOOK_SECRET) {
      const nedbankSignature = req.headers.get("X-Nedbank-Signature");
      if (!nedbankSignature) {
        return new Response("Missing webhook signature", { status: 401 });
      }

      const isValid = await validateNedbankSignature(body, nedbankSignature, NEDBANK_WEBHOOK_SECRET);
      if (!isValid) {
        console.error("Invalid Nedbank webhook signature");
        return new Response("Invalid signature", { status: 401 });
      }
    } else {
      // NEDBANK_WEBHOOK_SECRET is required for security. Reject requests until configured.
      // Set it via: supabase secrets set NEDBANK_WEBHOOK_SECRET=your-webhook-secret
      // This secret will be provided by Nedbank when API access is approved.
      console.error("NEDBANK_WEBHOOK_SECRET not configured — rejecting webhook");
      return new Response(
        "Webhook secret not configured. Set NEDBANK_WEBHOOK_SECRET in Supabase secrets.",
        { status: 503 }
      );
    }

    const event = JSON.parse(body);
    const eventId = event.id ?? event.eventId ?? `${event.payment_id}_${Date.now()}`;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Idempotency check
    const { data: existing } = await supabase
      .from("webhook_events")
      .select("id")
      .eq("external_id", eventId)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ status: "already_processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process event type
    let result = null;
    const eventType = event.type ?? event.eventType ?? "";

    switch (eventType) {
      case "payment.status.success":
      case "PAYMENT_SUCCESS":
        result = await handlePaymentSuccess(supabase, event);
        break;
      case "payment.status.failed":
      case "PAYMENT_FAILED":
        result = await handlePaymentFailed(supabase, event);
        break;
      case "payment.status.pending":
      case "PAYMENT_PENDING":
        result = await handlePaymentPending(supabase, event);
        break;
      default:
        console.log(`Unhandled Nedbank event type: ${eventType}`);
    }

    // Record processed event
    await supabase.from("webhook_events").insert({
      external_id: eventId,
      source: "nedbank",
      event_type: eventType,
      status: "processed",
      payload: event,
      processed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ status: "processed", result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Nedbank webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function validateNedbankSignature(
  body: string,
  receivedSignature: string,
  secret: string
): Promise<boolean> {
  // Nedbank uses HMAC-SHA256 — adjust when Nedbank confirms their signing method
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
    encoder.encode(body)
  );

  const expectedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer))
  );

  return receivedSignature === expectedSignature;
}

async function handlePaymentSuccess(
  supabase: ReturnType<typeof createClient>,
  event: Record<string, unknown>
) {
  const paymentId = event.payment_id as string;
  const nedbankReference = event.reference as string;

  // Update transfer status
  const { data: transfer, error } = await supabase
    .from("venture_transfers")
    .update({
      status: "transferred",
      nedbank_status: "success",
      nedbank_reference: nedbankReference,
      transferred_at: new Date().toISOString(),
    })
    .eq("nedbank_payment_id", paymentId)
    .select("id, to_user_id, amount, venture_id")
    .single();

  if (error) {
    console.error("Failed to update transfer:", error);
    return null;
  }

  if (transfer) {
    // Queue notification to recipient
    await supabase.from("notification_log").insert({
      user_id: transfer.to_user_id as string,
      venture_id: transfer.venture_id as string,
      type: "transfer_received",
      channel: "email",
      subject: "💰 Payment Received",
      body: `Your payment of R${transfer.amount} has been sent via Nedbank.`,
      status: "pending",
    });

    console.log(`✅ Payment success: Transfer ${transfer.id} marked as transferred`);
  }

  return transfer;
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  event: Record<string, unknown>
) {
  const paymentId = event.payment_id as string;
  const failureReason = (event.failure_reason as string) ?? "Payment failed";

  const { data: transfer, error } = await supabase
    .from("venture_transfers")
    .update({
      status: "failed",
      nedbank_status: "failed",
      failed_at: new Date().toISOString(),
      failure_reason: failureReason,
    })
    .eq("nedbank_payment_id", paymentId)
    .select("id, from_user_id, amount, venture_id")
    .single();

  if (error) {
    console.error("Failed to update failed transfer:", error);
    return null;
  }

  if (transfer) {
    // Notify sender about failure
    await supabase.from("notification_log").insert({
      user_id: transfer.from_user_id as string,
      venture_id: transfer.venture_id as string,
      type: "transfer_failed",
      channel: "email",
      subject: "⚠️ Payment Failed",
      body: `Your payment of R${transfer.amount} failed. Reason: ${failureReason}. Please retry.`,
      status: "pending",
    });

    console.log(`❌ Payment failed: Transfer ${transfer.id}`);
  }

  return transfer;
}

async function handlePaymentPending(
  supabase: ReturnType<typeof createClient>,
  event: Record<string, unknown>
) {
  const paymentId = event.payment_id as string;

  const { data: transfer } = await supabase
    .from("venture_transfers")
    .update({
      status: "processing",
      nedbank_status: "pending",
    })
    .eq("nedbank_payment_id", paymentId)
    .select("id")
    .single();

  console.log(`⏳ Payment pending: ${paymentId}`);
  return transfer;
}
