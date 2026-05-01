import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async () => {
  return new Response(JSON.stringify({ success: false, message: "Placeholder: connect Instagram Graph API and insert into content_analytics." }), { status: 200 });
});

