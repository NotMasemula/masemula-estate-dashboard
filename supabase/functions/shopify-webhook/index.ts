// Shopify Webhook Handler
// Receives order events from Shopify and creates venture transactions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

// Load secrets from environment (set via: supabase secrets set KEY=value)
// Falls back gracefully if not configured yet
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SHOPIFY_WEBHOOK_SECRET = Deno.env.get("SHOPIFY_WEBHOOK_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://notmasemula.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validate configuration
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase configuration");
    return new Response("Server configuration error", { status: 500 });
  }

  try {
    const body = await req.text();

    // Validate Shopify webhook signature (HMAC-SHA256)
    if (SHOPIFY_WEBHOOK_SECRET) {
      const shopifyHmac = req.headers.get("X-Shopify-Hmac-Sha256");
      if (!shopifyHmac) {
        return new Response("Missing webhook signature", { status: 401 });
      }

      const isValid = await validateShopifySignature(body, shopifyHmac, SHOPIFY_WEBHOOK_SECRET);
      if (!isValid) {
        console.error("Invalid Shopify webhook signature");
        return new Response("Invalid signature", { status: 401 });
      }
    } else {
      // SHOPIFY_WEBHOOK_SECRET is required for security. Reject requests until configured.
      // Set it via: supabase secrets set SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
      console.error("SHOPIFY_WEBHOOK_SECRET not configured — rejecting webhook");
      return new Response(
        "Webhook secret not configured. Set SHOPIFY_WEBHOOK_SECRET in Supabase secrets.",
        { status: 503 }
      );
    }

    const event = JSON.parse(body);
    const eventTopic = req.headers.get("X-Shopify-Topic") ?? "";
    const shopifyEventId = req.headers.get("X-Shopify-Webhook-Id") ?? event.id?.toString() ?? "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Idempotency check - skip already-processed events
    if (shopifyEventId) {
      const { data: existing } = await supabase
        .from("webhook_events")
        .select("id")
        .eq("external_id", shopifyEventId)
        .single();

      if (existing) {
        return new Response(JSON.stringify({ status: "already_processed" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Process the event
    let result = null;
    switch (eventTopic) {
      case "orders/paid":
        result = await handleOrderPaid(supabase, event);
        break;
      case "orders/refunded":
        result = await handleOrderRefunded(supabase, event);
        break;
      default:
        console.log(`Unhandled Shopify topic: ${eventTopic}`);
    }

    // Record processed event
    if (shopifyEventId) {
      await supabase.from("webhook_events").insert({
        external_id: shopifyEventId,
        source: "shopify",
        event_type: eventTopic,
        status: "processed",
        payload: event,
        processed_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({ status: "processed", result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Shopify webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function validateShopifySignature(
  body: string,
  receivedHmac: string,
  secret: string
): Promise<boolean> {
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

  const expectedHmac = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer))
  );

  return receivedHmac === expectedHmac;
}

async function handleOrderPaid(supabase: ReturnType<typeof createClient>, order: Record<string, unknown>) {
  // Find the active venture (defaulting to first active one)
  const { data: venture } = await supabase
    .from("shared_ventures")
    .select("id")
    .eq("status", "active")
    .limit(1)
    .single();

  if (!venture) {
    console.warn("No active venture found for Shopify order");
    return null;
  }

  const orderAmount = parseFloat(order.total_price as string) || 0;
  const orderId = order.id?.toString() ?? "";
  const orderNumber = order.order_number?.toString() ?? "";

  // Create transaction record
  const { data: transaction, error } = await supabase
    .from("venture_transactions")
    .insert({
      venture_id: venture.id,
      type: "revenue",
      category: "shopify_sale",
      description: `Shopify Order #${orderNumber}`,
      amount: orderAmount,
      source: "shopify",
      external_id: orderId,
      external_reference: orderNumber,
      approval_status: "pending",
      transaction_date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create transaction: ${error.message}`);
  }

  console.log(`✅ Created Shopify transaction: ${transaction.id} for R${orderAmount}`);
  return transaction;
}

async function handleOrderRefunded(supabase: ReturnType<typeof createClient>, order: Record<string, unknown>) {
  const refunds = (order.refunds as Array<Record<string, unknown>>) ?? [];
  const refundAmount = refunds.reduce((sum, r) => {
    const transactions = (r.transactions as Array<Record<string, unknown>>) ?? [];
    return sum + transactions.reduce((s, t) => s + (parseFloat(t.amount as string) || 0), 0);
  }, 0);

  const { data: venture } = await supabase
    .from("shared_ventures")
    .select("id")
    .eq("status", "active")
    .limit(1)
    .single();

  if (!venture) return null;

  const { data: transaction, error } = await supabase
    .from("venture_transactions")
    .insert({
      venture_id: venture.id,
      type: "refund",
      category: "shopify_refund",
      description: `Shopify Refund — Order #${order.order_number}`,
      amount: -Math.abs(refundAmount),
      source: "shopify",
      external_id: order.id?.toString() ?? "",
      approval_status: "pending",
      transaction_date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create refund: ${error.message}`);
  }

  return transaction;
}
