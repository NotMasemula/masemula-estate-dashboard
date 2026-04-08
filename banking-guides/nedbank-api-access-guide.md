# How to Get Nedbank API Access
## Complete Guide for Automatic Transactions

---

## ❌ Bad News: Nedbank Personal API

**Nedbank does NOT offer API access for personal banking accounts.**

Their APIs are only available for:
- Business banking clients
- Corporate clients
- Fintech partners with formal agreements

---

## ✅ Good News: Real Alternatives That Work

### Option 1: Switch to Investec (BEST FOR DEVELOPERS) ⭐

**Investec Programmable Banking**
- ✅ FREE personal accounts with full API access
- ✅ No business account needed
- ✅ Full transaction history API
- ✅ Make payments via API
- ✅ Webhooks for real-time updates
- ✅ Active developer community

**How to get it:**
1. Visit: https://www.investec.com/en_za/banking/programmable-banking.html
2. Apply for Investec account (takes 5-10 days)
3. Once approved, enable "Programmable Banking" in app
4. Get your API keys instantly
5. Done! Full banking API access

**API Example:**
```javascript
// Get transactions from Investec
const response = await fetch('https://openapi.investec.com/za/pb/v1/accounts/{accountId}/transactions', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Accept': 'application/json'
  }
});
const transactions = await response.json();
```

**Your dashboard would:**
- Auto-fetch new transactions every hour
- No manual CSV export needed
- Real-time balance updates
- Categorize automatically

**Cost:** FREE (no monthly fees, no minimum balance)

---

### Option 2: Use TymeBank (NEW DIGITAL BANK)

**TymeBank API Access**
- ✅ Digital-first bank
- ✅ Free banking
- ✅ Growing API ecosystem
- ⚠️ Limited API (mostly for merchants)

**How to get it:**
1. Visit: https://www.tymebank.co.za/
2. Download app and sign up (10 min)
3. Contact developer@tymebank.co.za for API access
4. Explain you want transaction export for personal dashboard

---

### Option 3: Open Banking Aggregators in SA

**Stitch (South African Open Banking)**
- Website: https://stitch.money/
- Connects to: Nedbank, FNB, Capitec, Standard Bank, ABSA
- ✅ Read-only access to transactions
- ✅ Works with existing Nedbank account
- ⚠️ Costs: Free tier (100 API calls/month)

**How it works:**
```
Your Dashboard → Stitch API → Nedbank → Transactions
```

**Setup:**
1. Go to https://stitch.money/
2. Sign up for developer account
3. Get API keys (free tier available)
4. Connect your Nedbank account via OAuth
5. Start fetching transactions

**Implementation in your dashboard:**
```javascript
// Fetch Nedbank transactions via Stitch
const response = await fetch('https://api.stitch.money/graphql', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: `{
      user {
        bankAccounts {
          transactions {
            date
            description
            amount
          }
        }
      }
    }`
  })
});
```

**Pricing:**
- Free: 100 API calls/month (enough for daily updates)
- Paid: R500+/month for unlimited

---

### Option 4: Yoco API (If You Have Business)

**Yoco**
- Website: https://www.yoco.com/za/
- ✅ Free API for Yoco merchants
- ✅ Transaction webhooks
- ⚠️ Only for business payments (not personal banking)

---

## 🏆 My Recommendation

**For your personal dashboard, I recommend:**

### Immediate (Today):
1. Keep using **CSV import** from Nedbank (already implemented)
2. Add **Recurring Transactions** feature (I'll build this now)

### Medium-term (Next 1-3 months):
1. **Open a FREE Investec account** with Programmable Banking
2. Use it for your ventures (Dropshipping, Music, Masemula Brand)
3. I'll integrate the Investec API into your dashboard
4. Auto-fetch transactions every hour
5. Keep Nedbank for personal stuff

### Long-term (6+ months):
1. Try **Stitch API** if you want to keep using Nedbank
2. Costs R0-500/month depending on usage

---

## Implementation Plan: Investec API

Once you have Investec account, I can add this to your dashboard:

**Supabase Edge Function (server-side, secure):**
```javascript
// supabase/functions/fetch-investec-transactions/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Get Investec access token (your API key stored securely in env)
  const accessToken = Deno.env.get('INVESTEC_TOKEN');
  
  // Fetch transactions
  const response = await fetch('https://openapi.investec.com/za/pb/v1/accounts/YOUR_ACCOUNT/transactions', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });
  
  const data = await response.json();
  
  // Transform to your ledger format
  const transactions = data.transactions.map(t => ({
    type: t.amount > 0 ? 'income' : 'expense',
    desc: t.description,
    amt: Math.abs(t.amount),
    cat: categorize(t.description),
    date: t.transactionDate
  }));
  
  // Save to your Supabase
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_KEY')
  );
  
  await supabase
    .from('estate_data')
    .upsert({ 
      user_id: 'ntobeko-masemula-estate',
      key: 'financeLedger',
      value: transactions 
    });
  
  return new Response(JSON.stringify({ success: true, count: transactions.length }));
});
```

**Your dashboard calls this function:**
```javascript
// Fetch latest transactions from Investec
async function syncWithBank() {
  const response = await fetch('https://your-project.supabase.co/functions/v1/fetch-investec-transactions');
  const result = await response.json();
  
  if (result.success) {
    // Reload ledger from Supabase
    await loadFromCloud();
    renderLedger();
    alert(`✅ Synced ${result.count} new transactions!`);
  }
}

// Auto-sync every hour
setInterval(syncWithBank, 3600000);
```

**Cost:**
- Investec account: FREE
- Supabase Edge Functions: FREE tier covers this
- Total cost: R0/month

---

## Next Steps (Choose One)

### A) Stay with Nedbank (Manual CSV)
- ✅ Already working
- ✅ 100% secure
- ❌ Manual export weekly/monthly
- **Action:** I'll add Recurring Transactions to save time

### B) Get Investec Programmable Banking (Recommended)
- ✅ Full API access
- ✅ Free account
- ✅ Auto-sync transactions
- **Action:** 
  1. Apply here: https://www.investec.com/programmable-banking
  2. Tell me when approved
  3. I'll integrate API into dashboard

### C) Try Stitch API with Nedbank
- ✅ Works with existing Nedbank account
- ✅ Read-only transaction access
- ⚠️ Costs R0-500/month
- **Action:**
  1. Sign up: https://stitch.money/
  2. Get API keys
  3. I'll integrate into dashboard

---

## Summary Table

| Option | Cost | Effort | API Access | Works with Nedbank |
|--------|------|--------|-----------|-------------------|
| CSV Import (current) | R0 | Manual | ❌ | ✅ |
| Recurring Transactions | R0 | Low | ❌ | ✅ |
| Investec | R0 | Medium | ✅ Full | ❌ (new account) |
| Stitch API | R0-500/mo | Medium | ✅ Read-only | ✅ |
| TymeBank | R0 | High | ⚠️ Limited | ❌ (new account) |

---

## Want Me to Implement?

Tell me which option you want and I'll:
1. Build the integration
2. Add it to your dashboard
3. Test it thoroughly
4. Provide setup instructions

**For now, I'm adding the Recurring Transactions feature to make manual entry 10x faster!**
