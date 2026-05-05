import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Base sync client for all estate data sections
 * Handles Supabase connection, validation, and real-time updates
 */
export class BaseSyncClient {
  protected supabase: SupabaseClient;
  protected tableName = "estate_data";
  protected userId: string;

  constructor(supabaseUrl: string, serviceRoleKey: string, userId: string) {
    this.supabase = createClient(supabaseUrl, serviceRoleKey);
    this.userId = userId;
  }

  /**
   * Upsert data to Supabase
   */
  async upsertData(data: Record<string, any>): Promise<void> {
    const payload = {
      user_id: this.userId,
      data: data,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.supabase
      .from(this.tableName)
      .upsert(payload, { onConflict: "user_id" });

    if (error) throw new Error(`Upsert failed: ${error.message}`);
  }

  /**
   * Fetch data from Supabase
   */
  async fetchData(): Promise<Record<string, any>> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("data")
      .eq("user_id", this.userId)
      .single();

    if (error) throw new Error(`Fetch failed: ${error.message}`);
    return data?.data || {};
  }

  /**
   * Subscribe to real-time updates
   */
  subscribeToUpdates(
    callback: (data: Record<string, any>) => void
  ): { unsubscribe: () => void } {
    const channel = this.supabase
      .channel(`${this.tableName}:${this.userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: this.tableName,
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => {
          if (payload.new?.data) {
            callback(payload.new.data);
          }
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        this.supabase.removeChannel(channel);
      },
    };
  }

  /**
   * Validate data against schema
   */
  validateSchema(data: Record<string, any>, schema: Record<string, any>): boolean {
    // Basic validation - can be extended
    if (!data.metadata || !data.metadata.last_updated) {
      throw new Error("Missing metadata.last_updated");
    }
    return true;
  }
}

/**
 * Utility: Add timestamps and version
 */
export function stampData(data: Record<string, any>): Record<string, any> {
  return {
    ...data,
    metadata: {
      last_updated: new Date().toISOString(),
      sync_version: "1.0",
    },
  };
}

/**
 * Utility: Read JSON file
 */
export async function readJsonFile(filePath: string): Promise<Record<string, any>> {
  const fs = await import("fs").then((m) => m.promises);
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content);
}

/**
 * Utility: Write JSON file
 */
export async function writeJsonFile(
  filePath: string,
  data: Record<string, any>
): Promise<void> {
  const fs = await import("fs").then((m) => m.promises);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}
