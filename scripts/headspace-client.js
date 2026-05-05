import { BaseSyncClient, stampData, readJsonFile } from "./base-sync-client";

/**
 * Headspace Sync Client
 * Synchronizes wellness, mood, and journal data to Supabase
 */
class HeadspaceSyncClient extends BaseSyncClient {
  calculateStreaks(goals) {
    const streaks = {};

    goals.forEach((goal) => {
      if (goal.last_completed) {
        const lastDate = new Date(goal.last_completed);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 1) {
          streaks[goal.id] = goal.streak + 1;
        } else if (diffDays === 1) {
          streaks[goal.id] = 1;
        } else {
          streaks[goal.id] = 0;
        }
      }
    });

    return streaks;
  }

  calculateMoodAverage(logs) {
    if (!logs || logs.length === 0) return 0;
    const total = logs.reduce((sum, log) => sum + (log.score || 0), 0);
    return parseFloat((total / logs.length).toFixed(1));
  }

  async sync(filePath) {
    console.log(`🧠 Syncing headspace from ${filePath}...`);

    const data = await readJsonFile(filePath);
    this.validateSchema(data, {});

    // Calculate streaks
    const streaks = this.calculateStreaks(data.wellness_goals);
    data.streaks = { ...data.streaks, ...streaks };

    // Calculate mood averages
    data.summary.avg_mood = this.calculateMoodAverage(data.mood_log);
    data.summary.total_journal_entries = data.journal_entries?.length || 0;
    data.summary.total_wellness_completions =
      Object.values(streaks).reduce((sum, streak) => sum + streak, 0) || 0;

    const payload = stampData(data);

    await this.upsertData(payload);
    console.log(`✅ Headspace synced successfully (Mood: ${data.summary.avg_mood})`);
  }
}

// Main execution
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.HEADSPACE_USER_ID || "ntobeko-headspace";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const client = new HeadspaceSyncClient(supabaseUrl, serviceRoleKey, userId);
const filePath = process.argv[3] || "docs/headspace.json";

client
  .sync(filePath)
  .catch((error) => {
    console.error("Sync failed:", error.message);
    process.exit(1);
  });
