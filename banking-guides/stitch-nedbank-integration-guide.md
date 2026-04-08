# Stitch API Integration for Nedbank
## Step-by-Step Implementation Guide

---

## STEP 1: Sign Up for Stitch (5-10 minutes)

### Create Account
1. Go to https://stitch.money/
2. Click "Get Started" or "Sign Up"
3. Fill in business details:
   - Business name: "Masemula Estate" (or your name)
   - Email: Your email
   - Phone: Your number
4. Verify email

### Get API Keys
1. Log into Stitch Dashboard
2. Go to "Developers" → "API Keys"
3. Create new API key
4. Copy and save:
   - **Client ID**: `test_xxxxx` (for testing)
   - **Client Secret**: `test_secret_xxxxx` (for testing)
   
⚠️ **IMPORTANT:** Start with TEST credentials first!

---

## STEP 2: Connect Your Nedbank Account (One-time)

### Via Stitch Dashboard
1. In Stitch Dashboard → "Linked Accounts"
2. Click "Link Bank Account"
3. Select "Nedbank"
4. You'll be redirected to Nedbank login
5. Log in with your Nedbank credentials
6. Authorize Stitch to read transactions (read-only)
7. Redirected back to Stitch - account now linked!

### What Stitch Can Access
✅ Transaction history (read-only)
✅ Account balance (read-only)
❌ Cannot make payments (unless you enable)
❌ Cannot transfer money
❌ Cannot change account settings

**100% secure - OAuth standard used by Google, Facebook, etc.**

---

## STEP 3: I'll Implement the Integration

Once you have your Stitch API keys, I'll add:

### A) Supabase Edge Function (Secure Backend)

This runs on Supabase servers (not in browser) to keep API keys secure:

```typescript
// supabase/functions/fetch-nedbank-transactions/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  // Stitch API credentials (stored securely in Supabase env)
  const clientId = Deno.env.get('STITCH_CLIENT_ID');
  const clientSecret = Deno.env.get('STITCH_CLIENT_SECRET');
  
  // Get OAuth token from Stitch
  const tokenResponse = await fetch('https://api.stitch.money/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation {
          clientTokenCreate(input: {
            clientId: "${clientId}",
            clientSecret: "${clientSecret}"
          }) {
            token
          }
        }
      `
    })
  });
  
  const { data: tokenData } = await tokenResponse.json();
  const token = tokenData.clientTokenCreate.token;
  
  // Fetch transactions from Nedbank via Stitch
  const transactionsResponse = await fetch('https://api.stitch.money/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `
        query {
          user {
            bankAccounts {
              accountNumber
              currentBalance
              transactions(first: 100) {
                edges {
                  node {
                    id
                    date
                    description
                    amount
                    runningBalance
                  }
                }
              }
            }
          }
        }
      `
    })
  });
  
  const { data } = await transactionsResponse.json();
  const transactions = data.user.bankAccounts[0].transactions.edges;
  
  // Transform to your ledger format
  const formattedTransactions = transactions.map(({ node }) => ({
    type: node.amount > 0 ? 'income' : 'expense',
    desc: node.description,
    amt: Math.abs(node.amount),
    cat: categorizeTransaction(node.description),
    date: node.date
  }));
  
  // Save to Supabase estate_data
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_KEY')
  );
  
  const { data: existing } = await supabase
    .from('estate_data')
    .select('data')
    .eq('user_id', 'ntobeko-masemula-estate')
    .single();
  
  const currentLedger = existing?.data?.financeLedger || [];
  const mergedLedger = mergeTransactions(currentLedger, formattedTransactions);
  
  await supabase
    .from('estate_data')
    .update({ 
      data: { 
        ...existing.data,
        financeLedger: mergedLedger 
      }
    })
    .eq('user_id', 'ntobeko-masemula-estate');
  
  return new Response(
    JSON.stringify({ 
      success: true, 
      newTransactions: formattedTransactions.length,
      balance: data.user.bankAccounts[0].currentBalance
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});

function categorizeTransaction(description) {
  const desc = description.toLowerCase();
  if (desc.includes('shopify')) return 'Dropshipping';
  if (desc.includes('spotify') || desc.includes('distrokid')) return 'Music';
  if (desc.includes('facebook') || desc.includes('google ads')) return 'Ads';
  return 'Other';
}

function mergeTransactions(existing, newTxs) {
  // Merge and deduplicate based on date + description + amount
  const existingKeys = new Set(existing.map(t => `${t.date}_${t.desc}_${t.amt}`));
  const unique = newTxs.filter(t => !existingKeys.has(`${t.date}_${t.desc}_${t.amt}`));
  return [...unique, ...existing];
}
```

### B) Dashboard UI Updates

I'll add to Finance section:

```html
<!-- Nedbank Auto-Sync Card -->
<div class="card mb-10">
  <div class="card-title">Nedbank Auto-Sync</div>
  <div id="stitch-status" style="font-size:12px;margin-bottom:10px">
    <span style="color:var(--muted)">Status:</span>
    <span id="stitch-connected" style="color:var(--green)">✓ Connected to Nedbank</span>
  </div>
  <div style="font-size:11px;color:var(--muted);margin-bottom:10px">
    Last synced: <span id="last-sync-time">Never</span>
  </div>
  <button class="btn btn-gold" onclick="syncNedbank()">🔄 Sync Now</button>
  <div style="font-size:10px;color:var(--muted);margin-top:10px">
    Syncs automatically every hour
  </div>
</div>
```

```javascript
// Sync Nedbank transactions
async function syncNedbank() {
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '⏳ Syncing...';
  
  try {
    const response = await fetch(
      'https://romytadgdnpphqzlseaa.supabase.co/functions/v1/fetch-nedbank-transactions',
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      // Reload ledger from Supabase
      await loadFromCloud();
      renderLedger();
      updateFinanceTotals();
      
      document.getElementById('last-sync-time').textContent = new Date().toLocaleTimeString();
      alert(`✅ Synced ${result.newTransactions} new transactions!\nBalance: R${result.balance.toLocaleString()}`);
    }
  } catch (err) {
    alert('❌ Sync failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Sync Now';
  }
}

// Auto-sync every hour
setInterval(async () => {
  await syncNedbank();
}, 3600000);
```

---

## STEP 4: Deploy Supabase Function

Once you give me your Stitch API keys, I'll:

1. Create the Supabase Edge Function
2. Set up environment variables securely
3. Deploy the function
4. Update your dashboard HTML
5. Test with your Nedbank account

---

## Pricing & Limits

### Stitch Pricing
- **Free Tier**: 100 API calls/month
- **Paid**: R500+/month for unlimited

### Usage Estimate
- Sync once per hour = ~720 calls/month
- **You'll need paid plan** (R500-1000/month)

### Alternative: Manual Sync
- Sync only when you click button
- ~30 calls/month = FREE tier

---

## Security

### How API Keys Are Stored
- ✅ Stitch keys stored in Supabase environment (not in dashboard HTML)
- ✅ Only Edge Function can access keys
- ✅ OAuth token rotates automatically
- ✅ Read-only access to Nedbank (can't transfer money)

### What Can Go Wrong?
- ❌ If someone hacks Supabase env → they can read your transactions
- ✅ But they CANNOT transfer money or access Nedbank directly
- ✅ You can revoke Stitch access anytime in Nedbank

---

## Next Steps

**Tell me when you:**
1. ✅ Created Stitch account
2. ✅ Connected Nedbank account
3. ✅ Got API keys (Client ID + Secret)

Then I'll:
1. Create Supabase Edge Function
2. Update dashboard with sync button
3. Test it live
4. Deploy to production

**Ready to start?** 
👉 Go to https://stitch.money/ and sign up now!
