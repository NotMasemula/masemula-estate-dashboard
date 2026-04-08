# Deploying Stitch Integration to Supabase
## Complete Deployment Guide

---

## Prerequisites

Before deploying, make sure you have:
- ✅ Stitch account created at https://stitch.money/
- ✅ Nedbank account connected to Stitch
- ✅ Stitch API credentials (Client ID + Client Secret)
- ✅ Supabase CLI installed

---

## Step 1: Install Supabase CLI

### Windows (PowerShell):
```powershell
scoop install supabase
```

Or with npm:
```powershell
npm install -g supabase
```

### Verify installation:
```powershell
supabase --version
```

---

## Step 2: Login to Supabase

```powershell
supabase login
```

This will open your browser to authenticate with Supabase.

---

## Step 3: Link Your Supabase Project

```powershell
cd C:\Users\thabi\masemula-estate-dashboard

# Initialize Supabase in the project
supabase init

# Link to your existing project
supabase link --project-ref romytadgdnpphqzlseaa
```

When prompted, enter your database password.

---

## Step 4: Create the Edge Function

```powershell
# Create the function directory
supabase functions new fetch-nedbank-transactions
```

This creates: `supabase/functions/fetch-nedbank-transactions/index.ts`

---

## Step 5: Copy the Function Code

Copy the code from:
`C:\Users\thabi\.copilot\session-state\950d0ccb-c2aa-45ac-b341-d3cc685864cd\files\supabase-function-fetch-nedbank-transactions.ts`

To:
`C:\Users\thabi\masemula-estate-dashboard\supabase\functions\fetch-nedbank-transactions\index.ts`

---

## Step 6: Set Environment Variables (SECURE!)

### Option A: Via Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard/project/romytadgdnpphqzlseaa
2. Settings → Edge Functions → Environment Variables
3. Add these secrets:
   - `STITCH_CLIENT_ID` = `your_client_id_from_stitch`
   - `STITCH_CLIENT_SECRET` = `your_client_secret_from_stitch`

### Option B: Via CLI
```powershell
supabase secrets set STITCH_CLIENT_ID=your_client_id_from_stitch
supabase secrets set STITCH_CLIENT_SECRET=your_client_secret_from_stitch
```

⚠️ **NEVER** commit these secrets to Git!

---

## Step 7: Deploy the Edge Function

```powershell
supabase functions deploy fetch-nedbank-transactions
```

This will:
- Upload your function code
- Deploy it to Supabase servers
- Make it available at: `https://romytadgdnpphqzlseaa.supabase.co/functions/v1/fetch-nedbank-transactions`

---

## Step 8: Test the Function

### Test via CLI:
```powershell
supabase functions invoke fetch-nedbank-transactions --method POST
```

### Test via Dashboard:
```javascript
// In browser console on your dashboard
const response = await fetch('https://romytadgdnpphqzlseaa.supabase.co/functions/v1/fetch-nedbank-transactions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sb_publishable_ggs07ym7m21ZKiTwQdB94g_lFACej5D'
  }
});
const result = await response.json();
console.log(result);
```

Expected response:
```json
{
  "success": true,
  "newTransactions": 25,
  "totalTransactions": 125,
  "balance": 5432.50,
  "availableBalance": 5432.50,
  "accountNumber": "1234567890"
}
```

---

## Step 9: Enable Auto-Sync (Optional)

To enable hourly auto-sync, edit your dashboard HTML:

Find this line:
```javascript
let stitchAutoSyncEnabled = false; // Will be enabled after setup
```

Change to:
```javascript
let stitchAutoSyncEnabled = true; // Enabled!
```

Commit and push:
```powershell
git add index.html
git commit -m "Enable Stitch auto-sync"
git push
```

---

## Troubleshooting

### Error: "Stitch credentials not configured"
**Solution:** Set environment variables in Supabase Dashboard or via CLI

### Error: "No bank accounts found"
**Solution:** Make sure Nedbank is linked in your Stitch Dashboard

### Error: "Stitch auth failed: 401"
**Solution:** Check that Client ID and Secret are correct

### Error: "Token received, but no transactions"
**Solution:** Check if you have transactions in last 100 entries, or extend the query

### Error: "CORS error"
**Solution:** Function should handle CORS automatically, check browser console

---

## Monitoring

### View Function Logs:
```powershell
supabase functions logs fetch-nedbank-transactions
```

### View in Dashboard:
https://supabase.com/dashboard/project/romytadgdnpphqzlseaa/functions/fetch-nedbank-transactions/logs

---

## Cost Estimate

### Supabase Edge Functions:
- Free tier: 500K invocations/month
- Your usage: ~720/month (hourly sync) = **FREE**

### Stitch API:
- Free tier: 100 calls/month (manual sync only)
- Hourly auto-sync: ~720 calls/month = **R500-1000/month**

**Recommendation:** Start with manual sync (free) and upgrade later if needed.

---

## Security Checklist

Before going live, verify:

- ✅ API keys stored in Supabase environment (not in code)
- ✅ `.env` files added to `.gitignore`
- ✅ Stitch access set to read-only
- ✅ Function only accessible with valid Supabase key
- ✅ No hardcoded credentials anywhere

---

## Maintenance

### Update Function:
```powershell
# Edit the code
# Then redeploy:
supabase functions deploy fetch-nedbank-transactions
```

### Revoke Stitch Access:
1. Log into Nedbank Online Banking
2. Settings → Connected Apps
3. Remove "Stitch" access

### Delete Function:
```powershell
supabase functions delete fetch-nedbank-transactions
```

---

## Summary

After deployment, your dashboard will:
1. ✅ Show "Sync Nedbank Transactions" button
2. ✅ Fetch up to 100 recent transactions
3. ✅ Auto-categorize them intelligently
4. ✅ Merge with existing ledger (no duplicates)
5. ✅ Sync to Supabase automatically
6. ✅ Update balance in real-time
7. ✅ (Optional) Auto-sync every hour

**Test it:** Click the sync button in Finance → Ledger!
