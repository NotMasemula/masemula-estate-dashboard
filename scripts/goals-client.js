import { BaseSyncClient, stampData, readJsonFile } from "./base-sync-client";

/**
 * Goals Sync Client
 * Synchronizes goals and milestones to Supabase
 */
class GoalsSyncClient extends BaseSyncClient {
  calculateGoalStatus(goal) {
    if (goal.status === "completed") return "completed";

    const deadline = new Date(goal.deadline);
    const today = new Date();
    const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const progressNeeded = 100 / daysRemaining;
    const currentProgress = goal.progress || 0;

    if (currentProgress >= progressNeeded) {
      return "on-track";
    } else {
      return "at-risk";
    }
  }

  async sync(filePath) {
    console.log(`🎯 Syncing goals from ${filePath}...`);

    const data = await readJsonFile(filePath);
    this.validateSchema(data, {});

    // Calculate statuses and summary
    let totalGoals = data.goals?.length || 0;
    let completedGoals = (data.completed_goals?.length || 0) + (data.goals?.filter((g) => g.status === "completed").length || 0);
    let atRiskGoals = 0;
    let onTrackGoals = 0;

    data.goals?.forEach((goal) => {
      const status = this.calculateGoalStatus(goal);
      if (status === "at-risk") atRiskGoals++;
      if (status === "on-track") onTrackGoals++;
    });

    data.summary = {
      total_active_goals: totalGoals - completedGoals,
      completed_goals: completedGoals,
      at_risk_goals: atRiskGoals,
      on_track_goals: onTrackGoals,
    };

    const payload = stampData(data);

    await this.upsertData(payload);
    console.log(
      `✅ Goals synced successfully (${onTrackGoals} on-track, ${atRiskGoals} at-risk)`
    );
  }
}

// Main execution
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.GOALS_USER_ID || "ntobeko-goals";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const client = new GoalsSyncClient(supabaseUrl, serviceRoleKey, userId);
const filePath = process.argv[3] || "docs/goals.json";

client
  .sync(filePath)
  .catch((error) => {
    console.error("Sync failed:", error.message);
    process.exit(1);
  });
