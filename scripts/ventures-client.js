import { BaseSyncClient, stampData, readJsonFile } from "./base-sync-client";

/**
 * Ventures Sync Client
 * Synchronizes ventures data to Supabase
 */
class VenturesSyncClient extends BaseSyncClient {
  async sync(filePath) {
    console.log(`📊 Syncing ventures from ${filePath}...`);

    const data = await readJsonFile(filePath);
    this.validateSchema(data, {});

    // Calculate summary metrics
    const summary = {
      total_ventures: data.ventures?.length || 0,
      active_ventures: data.ventures?.filter((v) => v.status === "active")
        .length || 0,
      total_revenue: data.ventures?.reduce((sum, v) => sum + (v.revenue || 0), 0) || 0,
      total_expenses: data.ventures?.reduce((sum, v) => sum + (v.expenses || 0), 0) || 0,
      net_income: 0,
    };

    summary.net_income = summary.total_revenue - summary.total_expenses;

    const payload = stampData({
      ...data,
      summary,
    });

    await this.upsertData(payload);
    console.log(`✅ Ventures synced successfully`);
  }
}

// Main execution
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.VENTURES_USER_ID || "ntobeko-ventures";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const client = new VenturesSyncClient(supabaseUrl, serviceRoleKey, userId);
const filePath = process.argv[3] || "docs/ventures.json";

client
  .sync(filePath)
  .catch((error) => {
    console.error("Sync failed:", error.message);
    process.exit(1);
  });
