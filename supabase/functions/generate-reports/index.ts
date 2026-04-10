// Generate Reports
// Creates monthly and annual settlement reports for a venture

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://notmasemula.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Server configuration error", { status: 500 });
  }

  try {
    const { venture_id, settlement_id, report_type = "monthly" } = await req.json();

    if (!venture_id || !settlement_id) {
      return new Response(
        JSON.stringify({ error: "venture_id and settlement_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get settlement data
    const { data: settlement, error: settlementError } = await supabase
      .from("settlements")
      .select("*")
      .eq("id", settlement_id)
      .eq("venture_id", venture_id)
      .single();

    if (settlementError || !settlement) {
      return new Response(
        JSON.stringify({ error: "Settlement not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get venture info
    const { data: venture } = await supabase
      .from("shared_ventures")
      .select("*")
      .eq("id", venture_id)
      .single();

    // Get line items
    const { data: lineItems } = await supabase
      .from("settlement_line_items")
      .select("*")
      .eq("settlement_id", settlement_id)
      .order("type", { ascending: true });

    // Generate report
    const report = generateMonthlyReport(settlement, venture, lineItems ?? []);

    return new Response(
      JSON.stringify({ success: true, report }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Report generation error:", error);
    return new Response(
      JSON.stringify({ error: "Report generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateMonthlyReport(
  settlement: Record<string, unknown>,
  venture: Record<string, unknown> | null,
  lineItems: Array<Record<string, unknown>>
): Record<string, unknown> {
  const monthName = MONTHS[(settlement.period_month as number) - 1];
  const year = settlement.period_year as number;
  const ventureName = (venture?.name as string) ?? "Shared Venture";

  const revenues = lineItems.filter((i) => i.type === "revenue");
  const expenses = lineItems.filter((i) => i.type === "expense");

  return {
    title: `${ventureName} — ${monthName} ${year} Settlement Report`,
    period: {
      month: monthName,
      year,
      start: settlement.period_start,
      end: settlement.period_end,
    },
    venture: {
      name: ventureName,
      id: venture?.id,
      split: `${venture?.owner_profit_share ?? 50}% / ${venture?.partner_profit_share ?? 50}%`,
    },
    summary: {
      total_revenue: formatCurrency(settlement.total_revenue as number),
      shopify_revenue: formatCurrency(settlement.shopify_revenue as number),
      stripe_revenue: formatCurrency(settlement.stripe_revenue as number),
      total_expenses: formatCurrency(settlement.total_expenses as number),
      reinvestment: formatCurrency(settlement.reinvestment_amount as number),
      gross_profit: formatCurrency(settlement.gross_profit as number),
      net_profit: formatCurrency(settlement.net_profit as number),
    },
    payouts: {
      owner: {
        gross_share: formatCurrency(settlement.owner_gross_share as number),
        loan_deduction: settlement.loan_deduction_amount
          ? `-${formatCurrency(settlement.loan_deduction_amount as number)}`
          : null,
        net_payout: formatCurrency(settlement.owner_net_payout as number),
      },
      partner: {
        gross_share: formatCurrency(settlement.partner_gross_share as number),
        loan_addition: settlement.loan_deduction_amount && settlement.loan_debtor
          ? `+${formatCurrency(settlement.loan_deduction_amount as number)}`
          : null,
        net_payout: formatCurrency(settlement.partner_net_payout as number),
      },
    },
    line_items: {
      revenues: revenues.map(formatLineItem),
      expenses: expenses.map(formatLineItem),
    },
    signatures: {
      owner: {
        signed: settlement.owner_approved as boolean,
        signed_at: settlement.owner_approved_at as string | null,
        signature: settlement.owner_signature as string | null,
      },
      partner: {
        signed: settlement.partner_approved as boolean,
        signed_at: settlement.partner_approved_at as string | null,
        signature: settlement.partner_signature as string | null,
      },
    },
    status: settlement.status,
    generated_at: new Date().toISOString(),
    generated_by: "Masemula Estate OS — Automated Report",
  };
}

function formatCurrency(amount: number): string {
  return `R ${Number(amount ?? 0).toFixed(2)}`;
}

function formatLineItem(item: Record<string, unknown>) {
  return {
    description: item.description,
    category: item.category,
    amount: formatCurrency(item.amount as number),
  };
}
