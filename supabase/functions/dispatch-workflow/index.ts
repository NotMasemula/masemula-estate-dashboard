declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-dispatch-secret, x-masemula-key',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { status: 204, headers: CORS_HEADERS });
    }

    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    const body = await req.json().catch(() => ({}));
    const workflowId = body?.workflowId || body?.workflow || 'unknown';
    const userId = body?.user_id || 'masemula-dashboard';

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://romytadgdnpphqzlseaa.supabase.co';
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');

    // GitHub Actions dispatch configuration (optional)
    const GITHUB_PAT = Deno.env.get('GITHUB_PAT');
    const GITHUB_OWNER = Deno.env.get('GITHUB_OWNER');
    const GITHUB_REPO = Deno.env.get('GITHUB_REPO');
    const GITHUB_WORKFLOW = Deno.env.get('GITHUB_WORKFLOW'); // filename or id
    const GITHUB_REF = Deno.env.get('GITHUB_REF') || 'refs/heads/main';

    const responsePayload: any = {
      agent: 'Personal Assistant',
      workflow: workflowId,
      status: 'completed',
      timestamp: new Date().toISOString(),
      message: 'Edge function handled dispatch against live Supabase.',
      source: 'supabase',
      sections: [workflowId],
      updates: {},
      ui_actions: ['refresh_cards']
    };

    if (SERVICE_ROLE_KEY) {
      // Use REST API with explicit public schema targeting
      // The issue was that Supabase REST was looking in 'api' schema by default
      // Explicitly use public.estate_data table
      const upsertPayload = [{
        user_id: userId,
        data: {
          workflowId,
          summary: `Edge function run for ${workflowId}`,
          updated_at: new Date().toISOString()
        }
      }];

      // Primary attempt: Use public schema explicitly
      let res = await fetch(`${SUPABASE_URL}/rest/v1/public.estate_data`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(upsertPayload)
      });

      // Fallback 1: Try without schema prefix (uses default)
      if (!res.ok && (res.status === 404 || res.status === 406)) {
        res = await fetch(`${SUPABASE_URL}/rest/v1/estate_data`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(upsertPayload)
        });
      }

      // Fallback 2: Try api schema explicitly (for Supabase PostgREST default behavior)
      if (!res.ok && (res.status === 404 || res.status === 406)) {
        res = await fetch(`${SUPABASE_URL}/rest/v1/api.estate_data`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(upsertPayload)
        });
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        responsePayload.updates[workflowId] = {
          summary: 'Dispatch queued (DB write skipped)',
          updated_at: new Date().toISOString(),
          note: 'Database table not accessible - edge function still processed workflow'
        };
        responsePayload.message = 'Workflow processed but database write skipped (schema mismatch or access denied)';
      } else {
        responsePayload.updates[workflowId] = { summary: `Upserted by Edge Function`, updated_at: new Date().toISOString() };
      }
    } else {
      // No service key available — return a simulated response
      responsePayload.message = 'Simulation: no SERVICE_ROLE_KEY configured in Edge Function environment.';
      responsePayload.updates[workflowId] = { summary: `Simulated update for ${workflowId}`, updated_at: new Date().toISOString() };
    }

    // If GitHub dispatch credentials are present, attempt to dispatch a workflow
    if (GITHUB_PAT && GITHUB_OWNER && GITHUB_REPO && GITHUB_WORKFLOW) {
      try {
        const ghUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${encodeURIComponent(GITHUB_WORKFLOW)}/dispatches`;
        const ghBody = { ref: GITHUB_REF, inputs: { workflowId } };
        const ghRes = await fetch(ghUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GITHUB_PAT}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(ghBody)
        });

        if (ghRes.ok || ghRes.status === 204) {
          responsePayload.dispatch = { status: 'dispatched', httpStatus: ghRes.status };
        } else {
          const txt = await ghRes.text().catch(() => '');
          responsePayload.dispatch = { status: 'failed', httpStatus: ghRes.status, detail: txt };
        }
      } catch (e) {
        responsePayload.dispatch = { status: 'error', detail: String(e) };
      }
    }

    return jsonResponse(responsePayload);
  } catch (err) {
    return jsonResponse({ error: 'server_error', detail: String(err) }, 500);
  }
});