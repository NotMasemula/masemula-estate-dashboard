import { BaseSyncClient, stampData, readJsonFile } from "./base-sync-client";

/**
 * Finance Sync Client
 * Synchronizes finance data to Supabase
 */
class FinanceSyncClient extends BaseSyncClient {
  calculateNetWorth(data) {
    const assets = data.accounts?.reduce((sum, a) => sum + (a.balance || 0), 0) || 0;
    const investments = data.investments?.reduce((sum, i) => sum + (i.balance || 0), 0) || 0;
    const liabilities = 0;
    return assets + investments - liabilities;
  }

  calculateCashFlow(data) {
    const income = data.income?.ytd || 0;
    const expenses = data.expenses?.ytd || 0;
    return income - expenses;
  }

  async sync(filePath) {
    console.log(`💰 Syncing finance from ${filePath}...`);

    const data = await readJsonFile(filePath);
    this.validateSchema(data, {});

    // Calculate summary metrics
    data.summary.total_assets = data.accounts?.reduce((sum, a) => sum + (a.balance || 0), 0) || 0;
    data.summary.net_worth = this.calculateNetWorth(data);
    data.summary.cash_flow = this.calculateCashFlow(data);

    const payload = stampData(data);

    await this.upsertData(payload);
    console.log(`✅ Finance synced successfully (Net Worth: R${data.summary.net_worth})`);
  }
}

// Main execution
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.FINANCE_USER_ID || "ntobeko-finance";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const client = new FinanceSyncClient(supabaseUrl, serviceRoleKey, userId);
const filePath = process.argv[3] || "docs/finance.json";

client
  .sync(filePath)
  .catch((error) => {
    console.error("Sync failed:", error.message);
    process.exit(1);
  });
