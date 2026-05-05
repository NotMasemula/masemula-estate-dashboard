/**
 * Masemula Routine Client SDK
 * Supabase integration for routine data synchronization
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Metadata about the routine sync
 */
export interface RoutineMetadata {
  last_updated: string; // ISO 8601
  sync_version: string;
}

/**
 * Academic term data
 */
export interface TermData {
  term: number;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  exam_start: string;
  exam_end: string;
}

/**
 * Holiday/break data
 */
export interface HolidayData {
  name: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

/**
 * Academic calendar containing terms and holidays
 */
export interface AcademicCalendar {
  institution: string;
  program: string;
  current_term: number;
  academic_year: number;
  terms: TermData[];
  holidays: HolidayData[];
}

/**
 * A single activity block in a daily schedule
 */
export interface ScheduleBlock {
  time: string; // HH:MM-HH:MM format
  activity: string;
  type: "academic" | "personal" | "ventures" | "social" | "health" | "admin" | "creative" | "growth" | "recovery";
  location?: string;
}

/**
 * Daily schedule mapping (day name -> schedule blocks)
 */
export type DailySchedule = {
  [day: string]: ScheduleBlock[];
};

/**
 * Weekly schedule with term and holiday schedules
 */
export interface WeeklySchedule {
  schedule_type: "term-based" | "holiday-based";
  term_schedule: DailySchedule;
  holiday_schedule: DailySchedule;
}

/**
 * Venture/business data
 */
export interface VentureData {
  name: string;
  description: string;
  time_allocation_term?: string;
  time_allocation_holiday?: string;
  status: "active" | "inactive" | "paused";
}

/**
 * Social commitment data
 */
export interface SocialCommitment {
  type: string;
  name: string;
  frequency?: string;
  time_estimate?: string;
}

/**
 * Complete routine object - the main data structure
 */
export interface RoutineObject {
  metadata: RoutineMetadata;
  academic_calendar: AcademicCalendar;
  weekly_schedule: WeeklySchedule;
  ventures: VentureData[];
  social_life: SocialCommitment[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Change detection result
 */
export interface Change {
  path: string;
  type: "added" | "modified" | "removed";
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Sync event callback
 */
export type SyncCallback = (routine: RoutineObject) => void;

/**
 * Offline queue item
 */
interface QueueItem {
  id: string;
  timestamp: number;
  data: RoutineObject;
}

/**
 * RoutineClient - Main SDK class for routine synchronization
 */
export class RoutineClient {
  private supabase: SupabaseClient;
  private userId: string;
  private offlineQueue: Map<string, QueueItem> = new Map();
  private subscriptions: Map<string, SyncCallback> = new Map();
  private isOnline: boolean = true;
  private queueStorageKey = "routine-offline-queue";

  /**
   * Initialize the RoutineClient
   * @param supabaseUrl - Supabase project URL
   * @param anonKey - Supabase anonymous key
   * @param userId - User ID for the routine (default: from env or 'ntobeko-masemula-estate')
   */
  constructor(
    supabaseUrl: string,
    anonKey: string,
    userId: string = process.env.ROUTINE_USER_ID || "ntobeko-masemula-estate"
  ) {
    this.supabase = createClient(supabaseUrl, anonKey);
    this.userId = userId;
    this.initializeOfflineQueue();
    this.setupNetworkListener();
  }

  /**
   * Initialize offline queue from storage
   */
  private initializeOfflineQueue(): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = window.localStorage.getItem(this.queueStorageKey);
        if (stored) {
          const items = JSON.parse(stored) as QueueItem[];
          items.forEach((item) => {
            this.offlineQueue.set(item.id, item);
          });
        }
      }
    } catch (error) {
      console.warn("Failed to initialize offline queue:", error);
    }
  }

  /**
   * Setup network listener for online/offline events
   */
  private setupNetworkListener(): void {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.isOnline = true;
        this.processOfflineQueue();
      });
      window.addEventListener("offline", () => {
        this.isOnline = false;
      });
    }
  }

  /**
   * Process offline queue when connection is restored
   */
  private async processOfflineQueue(): Promise<void> {
    for (const [id, item] of this.offlineQueue) {
      try {
        await this.syncRoutineData(item.data);
        this.offlineQueue.delete(id);
      } catch (error) {
        console.error(`Failed to process queued item ${id}:`, error);
      }
    }
    this.persistOfflineQueue();
  }

  /**
   * Persist offline queue to storage
   */
  private persistOfflineQueue(): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const items = Array.from(this.offlineQueue.values());
        window.localStorage.setItem(this.queueStorageKey, JSON.stringify(items));
      }
    } catch (error) {
      console.warn("Failed to persist offline queue:", error);
    }
  }

  /**
   * Sync routine data to Supabase
   * @param routineData - The routine object to sync
   */
  async syncRoutineData(routineData: RoutineObject): Promise<void> {
    // Validate before sync
    const validation = this.validateRoutineSchema(routineData);
    if (!validation.valid) {
      throw new Error(`Routine validation failed: ${validation.errors.join(", ")}`);
    }

    if (!this.isOnline) {
      // Add to offline queue
      const queueItem: QueueItem = {
        id: `queue-${Date.now()}`,
        timestamp: Date.now(),
        data: routineData,
      };
      this.offlineQueue.set(queueItem.id, queueItem);
      this.persistOfflineQueue();
      console.warn("Offline: routine queued for sync");
      return;
    }

    try {
      const { error } = await this.supabase
        .from("estate_data")
        .upsert(
          {
            user_id: this.userId,
            data: { routine: routineData },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      // Clear any queued items after successful sync
      this.offlineQueue.clear();
      this.persistOfflineQueue();

      console.log("Routine synced successfully");
    } catch (error) {
      if (this.isOnline) {
        throw error;
      } else {
        // If we lost connection during sync, add to queue
        const queueItem: QueueItem = {
          id: `queue-${Date.now()}`,
          timestamp: Date.now(),
          data: routineData,
        };
        this.offlineQueue.set(queueItem.id, queueItem);
        this.persistOfflineQueue();
      }
    }
  }

  /**
   * Fetch routine data from Supabase
   * @param userId - User ID to fetch for (default: current user)
   */
  async getRoutineData(userId: string = this.userId): Promise<RoutineObject | null> {
    try {
      const { data, error } = await this.supabase
        .from("estate_data")
        .select("data")
        .eq("user_id", userId)
        .single();

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      if (!data || !data.data?.routine) {
        return null;
      }

      return data.data.routine as RoutineObject;
    } catch (error) {
      console.error("Failed to fetch routine data:", error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time routine updates
   * @param userId - User ID to subscribe to (default: current user)
   * @param callback - Function to call when routine updates
   */
  subscribeToRoutineUpdates(
    userId: string = this.userId,
    callback: SyncCallback
  ): { unsubscribe: () => void } {
    const subscriptionKey = `${userId}-subscription`;
    this.subscriptions.set(subscriptionKey, callback);

    // Set up real-time listener using Supabase v2 channel API
    const channelName = `routine-updates-${userId}`;
    const channel = this.supabase
      .channel(channelName)
      .on<{ user_id: string; data: { routine?: RoutineObject } }>(
        "postgres_changes",
        { event: "*", schema: "public", table: "estate_data" },
        (payload) => {
          const newRecord = payload.new as { user_id?: string; data?: { routine?: RoutineObject } } | undefined;
          if (newRecord?.user_id === userId && newRecord?.data?.routine) {
            callback(newRecord.data.routine);
          }
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        this.subscriptions.delete(subscriptionKey);
        void this.supabase.removeChannel(channel);
      },
    };
  }

  /**
   * Validate routine schema
   * @param routine - The routine object to validate
   */
  validateRoutineSchema(routine: RoutineObject): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!routine.metadata) {
      errors.push("Missing metadata");
    }
    if (!routine.academic_calendar) {
      errors.push("Missing academic_calendar");
    }
    if (!routine.weekly_schedule) {
      errors.push("Missing weekly_schedule");
    }
    if (!Array.isArray(routine.ventures)) {
      errors.push("ventures must be an array");
    }
    if (!Array.isArray(routine.social_life)) {
      errors.push("social_life must be an array");
    }

    // Validate metadata
    if (routine.metadata) {
      if (!routine.metadata.last_updated) {
        errors.push("metadata.last_updated is required");
      }
      if (!routine.metadata.sync_version) {
        errors.push("metadata.sync_version is required");
      }
    }

    // Validate academic calendar
    if (routine.academic_calendar) {
      if (!routine.academic_calendar.institution) {
        errors.push("academic_calendar.institution is required");
      }
      if (!Array.isArray(routine.academic_calendar.terms) || routine.academic_calendar.terms.length === 0) {
        warnings.push("academic_calendar should have at least one term");
      }

      // Validate terms
      routine.academic_calendar.terms.forEach((term, index) => {
        if (!term.start || !term.end) {
          errors.push(`Term ${index}: start and end dates are required`);
        }
      });
    }

    // Validate weekly schedule
    if (routine.weekly_schedule) {
      const validScheduleTypes: Array<"term-based" | "holiday-based"> = ["term-based", "holiday-based"];
      if (!validScheduleTypes.includes(routine.weekly_schedule.schedule_type)) {
        errors.push("Invalid schedule_type");
      }

      if (!routine.weekly_schedule.term_schedule) {
        warnings.push("term_schedule is empty");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Detect changes between two routine objects
   * @param current - Current routine object
   * @param previous - Previous routine object
   */
  detectChanges(current: RoutineObject, previous: RoutineObject): Change[] {
    const changes: Change[] = [];

    // Compare metadata
    if (JSON.stringify(current.metadata) !== JSON.stringify(previous.metadata)) {
      changes.push({
        path: "metadata",
        type: "modified",
        oldValue: previous.metadata,
        newValue: current.metadata,
      });
    }

    // Compare academic calendar
    if (JSON.stringify(current.academic_calendar) !== JSON.stringify(previous.academic_calendar)) {
      changes.push({
        path: "academic_calendar",
        type: "modified",
        oldValue: previous.academic_calendar,
        newValue: current.academic_calendar,
      });
    }

    // Compare weekly schedule
    if (JSON.stringify(current.weekly_schedule) !== JSON.stringify(previous.weekly_schedule)) {
      changes.push({
        path: "weekly_schedule",
        type: "modified",
        oldValue: previous.weekly_schedule,
        newValue: current.weekly_schedule,
      });
    }

    // Compare ventures
    if (JSON.stringify(current.ventures) !== JSON.stringify(previous.ventures)) {
      changes.push({
        path: "ventures",
        type: "modified",
        oldValue: previous.ventures,
        newValue: current.ventures,
      });
    }

    // Compare social life
    if (JSON.stringify(current.social_life) !== JSON.stringify(previous.social_life)) {
      changes.push({
        path: "social_life",
        type: "modified",
        oldValue: previous.social_life,
        newValue: current.social_life,
      });
    }

    return changes;
  }

  /**
   * Create a default routine object
   */
  static createDefaultRoutine(): RoutineObject {
    return {
      metadata: {
        last_updated: new Date().toISOString(),
        sync_version: "1.0",
      },
      academic_calendar: {
        institution: "NWU Potchefstroom",
        program: "Urban & Regional Planning",
        current_term: 1,
        academic_year: new Date().getFullYear(),
        terms: [],
        holidays: [],
      },
      weekly_schedule: {
        schedule_type: "term-based",
        term_schedule: {},
        holiday_schedule: {},
      },
      ventures: [],
      social_life: [],
    };
  }
}

/**
 * Create and export a default client instance for browser use
 */
export function createRoutineClient(
  supabaseUrl?: string,
  anonKey?: string,
  userId?: string
): RoutineClient {
  const url = supabaseUrl || process.env.SUPABASE_URL || "";
  const key = anonKey || process.env.SUPABASE_ANON_KEY || "";

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required");
  }

  return new RoutineClient(url, key, userId);
}

export default RoutineClient;
