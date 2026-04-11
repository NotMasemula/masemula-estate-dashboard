// Calculate Settlement
// Calculates monthly settlement for a shared venture

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
    const { venture_id, year, month } = await req.json();

    if (!venture_id || !year || !month) {
      return new Response(
        JSON.stringify({ error: "venture_id, year, and month are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get venture configuration
    const { data: venture, error: ventureError } = await supabase
      .from("shared_ventures")
      .select("*")
      .eq("id", venture_id)
      .single();

    if (ventureError || !venture) {
      return new Response(
        JSON.stringify({ error: "Venture not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate period dates
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0); // Last day of month

    const periodStartStr = periodStart.toISOString().split("T")[0];
    const periodEndStr = periodEnd.toISOString().split("T")[0];

    // Fetch approved transactions for the period
    const { data: transactions } = await supabase
      .from("venture_transactions")
      .select("*")
      .eq("venture_id", venture_id)
      .eq("approval_status", "approved")
      .gte("transaction_date", periodStartStr)
      .lte("transaction_date", periodEndStr);

    // Calculate totals
    const revenues = (transactions ?? []).filter((t) => t.type === "revenue");
    const expenses = (transactions ?? []).filter((t) => t.type === "expense");
    const refunds = (transactions ?? []).filter((t) => t.type === "refund");

    const totalRevenue = revenues.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalRefunds = Math.abs(refunds.reduce((sum, t) => sum + Number(t.amount), 0));
    const netRevenue = totalRevenue - totalRefunds;

    const shopifyRevenue = revenues
      .filter((t) => t.source === "shopify")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const stripeRevenue = revenues
      .filter((t) => t.source === "stripe")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpenses = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
    const sharedExpenses = expenses
      .filter((t) => t.is_shared_expense)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const ownerExpenseShare = sharedExpenses * (venture.owner_profit_share / 100);
    const partnerExpenseShare = sharedExpenses * (venture.partner_profit_share / 100);

    // Calculate gross profit
    const grossProfit = netRevenue - totalExpenses;

    // Reinvestment
    const reinvestmentAmount = grossProfit * (venture.reinvestment_percentage / 100);

    // Net profit to distribute
    const netProfit = grossProfit - reinvestmentAmount;

    // Split profit
    const ownerGrossShare = netProfit * (venture.owner_profit_share / 100);
    const partnerGrossShare = netProfit * (venture.partner_profit_share / 100);

    // Check for active startup loan
    let loanDeduction = 0;
    let loanDebtorUserId = null;

    const { data: startupCapital } = await supabase
      .from("startup_capital")
      .select("*")
      .eq("venture_id", venture_id)
      .eq("loan_active", true)
      .eq("fully_repaid", false)
      .single();

    if (startupCapital) {
      loanDebtorUserId = startupCapital.loan_debtor_user_id;

      if (startupCapital.loan_repayment_type === "lump_sum") {
        loanDeduction = startupCapital.loan_remaining;
      } else if (startupCapital.installment_type === "percentage") {
        // Percentage of debtor's profit share
        const debtorShare =
          loanDebtorUserId === venture.owner_user_id ? ownerGrossShare : partnerGrossShare;
        loanDeduction = debtorShare * (startupCapital.installment_percentage / 100);
      } else {
        // Fixed amount
        loanDeduction = Math.min(
          startupCapital.installment_fixed_amount,
          startupCapital.loan_remaining
        );
      }

      // Cap at remaining loan amount
      loanDeduction = Math.min(loanDeduction, startupCapital.loan_remaining);
    }

    // Final payouts
    let ownerNetPayout = ownerGrossShare;
    let partnerNetPayout = partnerGrossShare;

    if (loanDebtorUserId === venture.owner_user_id) {
      ownerNetPayout -= loanDeduction;
      partnerNetPayout += loanDeduction;
    } else if (loanDebtorUserId === venture.partner_user_id) {
      partnerNetPayout -= loanDeduction;
      ownerNetPayout += loanDeduction;
    }

    // Create or update settlement record
    const settlementData = {
      venture_id,
      period_year: year,
      period_month: month,
      period_start: periodStartStr,
      period_end: periodEndStr,
      total_revenue: netRevenue,
      shopify_revenue: shopifyRevenue,
      stripe_revenue: stripeRevenue,
      other_revenue: netRevenue - shopifyRevenue - stripeRevenue,
      total_expenses: totalExpenses,
      total_shared_expenses: sharedExpenses,
      owner_expense_share: ownerExpenseShare,
      partner_expense_share: partnerExpenseShare,
      reinvestment_amount: reinvestmentAmount,
      gross_profit: grossProfit,
      net_profit: netProfit,
      owner_gross_share: ownerGrossShare,
      partner_gross_share: partnerGrossShare,
      loan_deduction_amount: loanDeduction,
      loan_debtor: loanDebtorUserId,
      owner_net_payout: ownerNetPayout,
      partner_net_payout: partnerNetPayout,
      status: "draft",
      calculated_at: new Date().toISOString(),
    };

    const { data: settlement, error: settlementError } = await supabase
      .from("settlements")
      .upsert(settlementData, { onConflict: "venture_id,period_year,period_month" })
      .select()
      .single();

    if (settlementError) throw new Error(`Failed to save settlement: ${settlementError.message}`);

    // Update loan remaining if applicable
    if (startupCapital && loanDeduction > 0) {
      const newRemaining = startupCapital.loan_remaining - loanDeduction;
      await supabase
        .from("startup_capital")
        .update({
          loan_remaining: newRemaining,
          fully_repaid: newRemaining <= 0,
          repaid_at: newRemaining <= 0 ? new Date().toISOString() : null,
        })
        .eq("id", startupCapital.id);
    }

    return new Response(
      JSON.stringify({ success: true, settlement }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Settlement calculation error:", error);
    return new Response(
      JSON.stringify({ error: "Settlement calculation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
