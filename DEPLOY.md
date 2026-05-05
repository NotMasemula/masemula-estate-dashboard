What I changed

- Replaced `script.js` with a version that does NOT initialize a Supabase client in the browser and therefore will not make any page-init reads.
- Replaced `config.json` with a public-only configuration (no `supabaseKey` or other secrets).

How to verify

1. Open the live site: https://notmasemula.github.io/masemula-estate-dashboard/
2. Open DevTools → Console and Network.
3. Reload the page — you should no longer see repeated 406/PGRST errors from Supabase on page load.
4. Click a workflow button — the client will POST to the Edge Function URL configured in `config.json`.

If dispatch returns CORS/preflight errors

- Ensure the Edge Function has the `DISPATCH_SECRET` secret set if you configured `dispatchSecret` in `config.json`.
- Confirm the function returns HTTP 204/200 for OPTIONS preflight. The function in `supabase/functions/dispatch-workflow/index.ts` already responds to OPTIONS.

To publish alternate branch

If your Pages site uses the `main` branch rather than `gh-pages`, push these files to the branch that GitHub Pages uses. Example:

```bash
git checkout -b patch/stop-supabase-reads
git add script.js config.json DEPLOY.md
git commit -m "Stop browser Supabase reads; dispatch via Edge Function"
git push origin patch/stop-supabase-reads
```