import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  try {
    const { workflowFile, context } = await req.json();
    const owner = "NotMasemula";
    const repo = "masemula-estate-dashboard";
    const pat = Deno.env.get("GITHUB_PAT");
    if (!pat) return new Response(JSON.stringify({ error: "Missing GITHUB_PAT" }), { status: 500 });
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({ ref: "master", inputs: { context } }),
    });
    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: text }), { status: 500 });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});

