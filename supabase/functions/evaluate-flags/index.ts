import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const owner_uid = body.owner_uid as string | undefined;
    if (!owner_uid) return new Response(JSON.stringify({ error: "owner_uid required" }), { status: 400 });

    const { data: tasks } = await supabase.from("tasks").select("due_date,status").eq("owner_uid", owner_uid);
    const { data: ventures } = await supabase.from("ventures").select("created_at,status").eq("owner_uid", owner_uid);
    const { data: gymRows } = await supabase.from("habits_log").select("id").eq("owner_uid", owner_uid).eq("habit_key", "gym").eq("completed", true);
    const { data: deepRows } = await supabase.from("focus_sessions").select("duration_minutes").eq("owner_uid", owner_uid).eq("type", "deep_work");

    const now = Date.now();
    const overdue = (tasks || []).some((t) => t.status !== "complete" && t.due_date && (now - new Date(t.due_date).getTime()) > 3 * 86400000);
    const staleVenture = (ventures || []).some((v) => v.status === "active" && (now - new Date(v.created_at).getTime()) > 7 * 86400000);
    const gymCount = (gymRows || []).length;
    const deepHours = ((deepRows || []).reduce((s, r) => s + Number(r.duration_minutes || 0), 0) / 60);

    await supabase.from("estate_flags").delete().eq("owner_uid", owner_uid);
    const flags: Array<{ owner_uid: string; flag_key: string; flag_level: "red" | "amber" | "green"; flag_message: string }> = [];
    if (overdue || staleVenture) flags.push({ owner_uid, flag_key: "critical", flag_level: "red", flag_message: "Overdue tasks or inactive venture detected." });
    if (gymCount < 3 || deepHours < 10) flags.push({ owner_uid, flag_key: "warning", flag_level: "amber", flag_message: "Gym or deep work below weekly threshold." });
    if (!flags.length) flags.push({ owner_uid, flag_key: "healthy", flag_level: "green", flag_message: "All core targets are on track." });

    await supabase.from("estate_flags").insert(flags);
    return new Response(JSON.stringify({ success: true, count: flags.length }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});

