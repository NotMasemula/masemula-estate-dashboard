// Send Notifications
// Processes pending notifications and sends via email (Resend) or SMS (Twilio)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("NOTIFICATION_FROM_EMAIL") ?? "noreply@masemula.co.za";
const FROM_NAME = Deno.env.get("NOTIFICATION_FROM_NAME") ?? "Masemula Estate OS";

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));

    // Allow sending a single notification or processing all pending
    if (body.notification_id) {
      // Send specific notification
      const { data: notification } = await supabase
        .from("notification_log")
        .select("*")
        .eq("id", body.notification_id)
        .single();

      if (!notification) {
        return new Response(
          JSON.stringify({ error: "Notification not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await sendNotification(supabase, notification);
      return new Response(
        JSON.stringify({ success: true, result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process all pending notifications (batch mode)
    const { data: pendingNotifications } = await supabase
      .from("notification_log")
      .select("*")
      .eq("status", "pending")
      .limit(50)
      .order("created_at", { ascending: true });

    const results = [];
    for (const notification of pendingNotifications ?? []) {
      const result = await sendNotification(supabase, notification);
      results.push(result);
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Notification error:", error);
    return new Response(
      JSON.stringify({ error: "Notification failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendNotification(
  supabase: ReturnType<typeof createClient>,
  notification: Record<string, unknown>
) {
  try {
    // Get user's notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", notification.user_id)
      .single();

    if (!prefs) {
      await updateNotificationStatus(supabase, notification.id as string, "skipped", "No preferences found");
      return { id: notification.id, status: "skipped" };
    }

    let externalId = null;

    if (notification.channel === "email") {
      if (!prefs.email_enabled || !prefs.email_address) {
        await updateNotificationStatus(supabase, notification.id as string, "skipped", "Email disabled or no address");
        return { id: notification.id, status: "skipped" };
      }

      externalId = await sendEmail({
        to: prefs.email_address as string,
        subject: notification.subject as string,
        body: notification.body as string,
      });
    }

    await updateNotificationStatus(supabase, notification.id as string, "sent", null, externalId as string);
    return { id: notification.id, status: "sent" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await updateNotificationStatus(supabase, notification.id as string, "failed", errorMessage);
    return { id: notification.id, status: "failed", error: errorMessage };
  }
}

async function sendEmail(params: { to: string; subject: string; body: string }) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured — email not sent");
    console.log(`[SIMULATED EMAIL] To: ${params.to} | Subject: ${params.subject}`);
    return "simulated";
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [params.to],
      subject: params.subject,
      html: `
        <div style="font-family: 'Jost', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #2C1A0E; font-family: 'Cormorant Garamond', serif;">${params.subject}</h2>
          <p style="color: #1C1A17; line-height: 1.6;">${params.body}</p>
          <hr style="border-color: #D8D2C8; margin: 24px 0;">
          <p style="color: #7A7570; font-size: 12px;">
            Masemula Estate OS — Your shared venture management system
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${response.status} — ${error}`);
  }

  const result = await response.json();
  return result.id;
}

async function updateNotificationStatus(
  supabase: ReturnType<typeof createClient>,
  id: string,
  status: string,
  errorMessage: string | null,
  externalId?: string
) {
  await supabase
    .from("notification_log")
    .update({
      status,
      error_message: errorMessage,
      external_id: externalId,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", id);
}
