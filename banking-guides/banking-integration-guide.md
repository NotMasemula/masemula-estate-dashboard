# Banking Integration Guide
## Masemula Estate Dashboard

### Current Architecture
Your dashboard is a **static HTML file** hosted on GitHub Pages with:
- ✅ Client-side JavaScript only
- ✅ Supabase for data storage (cloud sync)
- ✅ No backend server
- ✅ All code runs in the browser

### Why Direct Banking API Integration Won't Work

**Security Issue:**
Banking APIs require:
1. **API keys/secrets** - Cannot be stored in client-side code (anyone can view your HTML source)
2. **OAuth authentication** - Requires a backend server to handle token exchange
3. **Server-to-server calls** - Banks don't allow direct browser → bank API calls

**What happens if you try:**
- Your API keys would be visible to anyone viewing page source
- Anyone could steal your credentials and access your bank account
- Most banking APIs block browser requests (CORS policy)

---

## Safe Banking Integration Options

### Option 1: CSV Import (✅ RECOMMENDED - Implemented)
**How it works:**
1. Export transactions from your banking app as CSV
2. Click "Import from Bank CSV" in Finance → Ledger
3. File processes locally in browser (never uploaded anywhere)
4. Transactions automatically populate your ledger

**Pros:**
- ✅ 100% secure - data never leaves your device
- ✅ Works with any South African bank
- ✅ No API keys or passwords needed
- ✅ One-time setup, works forever

**Cons:**
- ❌ Manual export from bank (monthly/weekly)
- ❌ Not real-time

**Supported CSV formats:**
- Standard Bank
- FNB
- Capitec
- Nedbank
- ABSA
- Any bank with CSV export

---

### Option 2: Manual Entry (✅ Already Implemented)
**Current solution:**
- Add income/expenses manually
- Syncs to Supabase automatically
- Works cross-device

**Best for:**
- Small number of transactions
- Full control over categorization
- Quick daily updates

---

### Option 3: Read-Only Banking Widgets
**If your bank offers embeddable widgets:**

Some banks provide secure iframes you can embed:
```html
<iframe src="https://your-bank.co.za/widget" sandbox="..."></iframe>
```

**Check if available:**
- Standard Bank: Online banking widgets
- FNB: FNB Connect
- Capitec: Business widgets

**Limitation:** View-only, doesn't populate your ledger

---

### Option 4: Backend + Open Banking API (Advanced)

**What you'd need:**
1. **Backend server** (Vercel, Netlify Functions, Supabase Edge Functions)
2. **Open Banking API** access
3. **OAuth flow implementation**

**South African Open Banking:**
- [Bank of South Africa API](https://www.resbank.co.za/)
- [Yoco API](https://developer.yoco.com/) - for payments
- Limited open banking compared to UK/EU

**Implementation:**
```
User → Frontend → Your Backend → Banking API → Your Backend → Frontend
         (HTML)    (Supabase      (Secure)      (Encrypts    (Display)
                    Function)                    data)
```

**Estimated effort:** 20-40 hours development

---

### Option 5: Banking Aggregator Services

**International services (may work in SA):**
- [Plaid](https://plaid.com/) - Not officially supported in SA
- [Yodlee](https://www.yodlee.com/) - Limited SA coverage
- [TrueLayer](https://truelayer.com/) - UK/EU focused

**South African alternatives:**
- [Investec Programmable Banking](https://www.investec.com/en_za/banking/programmable-banking.html)
- [22seven](https://www.22seven.com/) - Aggregator (no API)
- [Mint SA](https://www.mint.co.za/) - Personal finance (no API)

**Reality:** Most require business accounts or enterprise plans

---

## Recommended Solution: CSV Import

I've implemented a **CSV import feature** that:

1. **Detects your bank format automatically**
2. **Parses transactions** (date, description, amount, balance)
3. **Categorizes automatically** based on keywords
4. **Adds to your ledger** with one click
5. **100% client-side** - secure and private

### How to use:
1. Log into your banking app
2. Export transactions as CSV (last 30/60/90 days)
3. Go to Finance → Ledger
4. Click "Import from Bank CSV"
5. Select your CSV file
6. Preview and confirm import
7. Done! Transactions sync to Supabase

---

## Future: Supabase Edge Functions for Banking API

If you want real-time banking integration later:

**Architecture:**
```javascript
// Supabase Edge Function (runs on server)
Deno.serve(async (req) => {
  const apiKey = Deno.env.get('BANK_API_KEY'); // Secure!
  const response = await fetch('https://bank-api.co.za/transactions', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const data = await response.json();
  return new Response(JSON.stringify(data));
});
```

**Your dashboard calls:**
```javascript
const response = await fetch('https://your-project.supabase.co/functions/v1/get-transactions');
const transactions = await response.json();
```

**Pros:**
- ✅ API key stays on server (secure)
- ✅ Real-time updates
- ✅ Automatic categorization

**Cons:**
- ❌ Requires Supabase pro plan (R80+/month)
- ❌ Bank must have API (not all SA banks do)
- ❌ Complex OAuth setup

---

## Summary

| Solution | Security | Ease | Cost | Real-time | Recommended |
|----------|----------|------|------|-----------|-------------|
| CSV Import | ✅✅✅ | ✅✅ | Free | ❌ | ✅ **YES** |
| Manual Entry | ✅✅✅ | ✅✅✅ | Free | ✅ | ✅ Current |
| Widgets | ✅✅ | ✅ | Free | ✅ | ⚠️ If available |
| Edge Functions | ✅✅✅ | ❌ | R80+/mo | ✅ | ⚠️ Future |
| Aggregators | ✅ | ❌ | R150+/mo | ✅ | ❌ Not in SA |

**My recommendation:** Use CSV import for monthly reconciliation + manual entry for daily tracking.

---

## Questions?

**Q: Is CSV import secure?**  
A: Yes! File is processed 100% in your browser. Never uploaded to any server except your own Supabase (encrypted).

**Q: Which banks work?**  
A: All South African banks that export to CSV/Excel.

**Q: Can I automate the export?**  
A: Unfortunately no - banks require manual login for security.

**Q: Will this work on mobile?**  
A: Yes! Export CSV on phone, open dashboard, import.

**Q: What about real-time balance?**  
A: Manual entry or check your bank app. No secure way to auto-fetch without backend.
