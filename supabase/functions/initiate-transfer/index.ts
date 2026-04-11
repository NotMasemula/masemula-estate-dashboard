// Initiate Transfer
// Initiates a money transfer (manual instructions or Nedbank API when available)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Load secrets from environment (set via: supabase secrets set KEY=value)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const NEDBANK_CLIENT_ID = Deno.env.get("NEDBANK_CLIENT_ID") ?? "";
const NEDBANK_CLIENT_SECRET = Deno.env.get("NEDBANK_CLIENT_SECRET") ?? "";
const NEDBANK_API_BASE_URL = Deno.env.get("NEDBANK_API_BASE_URL") ?? "https://api.nedbank.co.za/apimarket/sandbox";

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
    const {
      settlement_id,
      from_user_id,
      to_user_id,
      amount,
      type = "profit_share",
      venture_id,
    } = await req.json();

    if (!settlement_id || !from_user_id || !to_user_id || !amount || !venture_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Determine transfer method
    const nedbankConfigured = !!(NEDBANK_CLIENT_ID && NEDBANK_CLIENT_SECRET);
    const paymentMethod = nedbankConfigured ? "nedbank_api" : "manual";

    let transferData: Record<string, unknown> = {
      settlement_id,
      venture_id,
      from_user_id,
      to_user_id,
      amount,
      type,
      payment_method: paymentMethod,
      status: "pending",
    };

    if (paymentMethod === "nedbank_api") {
      // Get recipient bank account
      const { data: bankAccount } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", to_user_id)
        .eq("is_primary", true)
        .single();

      if (!bankAccount) {
        return new Response(
          JSON.stringify({ error: "Recipient bank account not found. Add bank account details first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Initiate Nedbank payment
      const nedbankPayment = await initiateNedbankPayment({
        amount,
        recipientAccount: bankAccount.account_number,
        recipientName: bankAccount.account_holder,
        branchCode: bankAccount.branch_code ?? bankAccount.universal_branch_code ?? "198765",
        reference: `Masemula Venture Settlement`,
      });

      transferData = {
        ...transferData,
        status: "pending_automated",
        nedbank_payment_id: nedbankPayment.paymentId,
        initiated_at: new Date().toISOString(),
      };
    } else {
      // Manual transfer — provide instructions
      const { data: recipientAccount } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", to_user_id)
        .eq("is_primary", true)
        .single();

      const instructions = recipientAccount
        ? `Transfer R${amount} to: ${recipientAccount.bank_name} — ${recipientAccount.account_holder} — Acc: ${recipientAccount.account_number}`
        : `Transfer R${amount} via Nedbank app to the venture partner`;

      transferData = {
        ...transferData,
        status: "pending_manual_transfer",
        manual_instructions: instructions,
      };
    }

    // Create transfer record
    const { data: transfer, error } = await supabase
      .from("venture_transfers")
      .insert(transferData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create transfer: ${error.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        transfer,
        method: paymentMethod,
        instructions: paymentMethod === "manual" ? transferData.manual_instructions : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Initiate transfer error:", error);
    return new Response(
      JSON.stringify({ error: "Transfer initiation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function initiateNedbankPayment(params: {
  amount: number;
  recipientAccount: string;
  recipientName: string;
  branchCode: string;
  reference: string;
}) {
  // Step 1: Get OAuth token
  const tokenResponse = await fetch(`${NEDBANK_API_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${btoa(`${NEDBANK_CLIENT_ID}:${NEDBANK_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "payments",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Nedbank auth failed: ${tokenResponse.status}`);
  }

  const { access_token } = await tokenResponse.json();

  // Step 2: Initiate payment
  const paymentResponse = await fetch(`${NEDBANK_API_BASE_URL}/v1/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${access_token}`,
    },
    body: JSON.stringify({
      amount: {
        value: params.amount,
        currency: "ZAR",
      },
      creditorAccount: {
        identification: params.recipientAccount,
        schemeName: "BBAN",
        name: params.recipientName,
        branchCode: params.branchCode,
      },
      remittanceInformation: params.reference,
    }),
  });

  if (!paymentResponse.ok) {
    const errorBody = await paymentResponse.text();
    throw new Error(`Nedbank payment failed: ${paymentResponse.status} — ${errorBody}`);
  }

  return await paymentResponse.json();
}
