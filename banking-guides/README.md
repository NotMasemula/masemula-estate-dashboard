# 🏦 Banking Integration Guides

Complete documentation for connecting your Nedbank account to the Masemula Estate Dashboard.

## 📚 What's Inside

### Quick Start
- **[SETUP-WALKTHROUGH.md](SETUP-WALKTHROUGH.md)** - Step-by-step setup guide (start here!)

### Detailed Guides
- **[banking-integration-guide.md](banking-integration-guide.md)** - Overview of all banking options (CSV, Recurring, Stitch)
- **[nedbank-api-access-guide.md](nedbank-api-access-guide.md)** - Why Nedbank doesn't have APIs + alternatives
- **[stitch-nedbank-integration-guide.md](stitch-nedbank-integration-guide.md)** - Complete Stitch setup walkthrough
- **[supabase-deployment-guide.md](supabase-deployment-guide.md)** - How to deploy the Edge Function
- **[live-balance-monitoring-guide.md](live-balance-monitoring-guide.md)** - How live balance works

### Code
- **[supabase-function-fetch-nedbank-transactions.ts](supabase-function-fetch-nedbank-transactions.ts)** - Complete Edge Function code (ready to deploy)

---

## 🚀 Getting Started

### 1. Read the Quick Start Guide
Start with **SETUP-WALKTHROUGH.md** - it's a condensed version of the complete setup process in 6 phases.

### 2. Understand Your Options
Read **banking-integration-guide.md** to understand the three tiers of banking integration:
- ✅ CSV Import (works now, any SA bank)
- ✅ Recurring Transactions (works now)
- ⏳ Stitch Auto-Sync (requires setup)

### 3. Set Up Stitch (Optional)
If you want live balance monitoring:
1. Read **stitch-nedbank-integration-guide.md**
2. Sign up at https://stitch.money/
3. Connect your Nedbank account
4. Get API credentials

### 4. Deploy Supabase Function
Follow **supabase-deployment-guide.md** to:
1. Install Supabase CLI
2. Deploy the Edge Function
3. Configure secrets
4. Test the integration

### 5. Enable Auto-Sync
Edit `index.html` and set:
```javascript
let stitchAutoSyncEnabled = true;
```

---

## ✨ Features

### Multi-Account Support (NEW!)
The dashboard now supports displaying multiple bank accounts:
- **Dashboard**: Shows all accounts in compact view
- **Finance Tab**: Detailed breakdown per account
- **Total Balance**: Calculated across all accounts
- **Account Labels**: Account name, type, and last 4 digits

### Example Data Structure
```json
{
  "accounts": [
    {
      "accountNumber": "1234567890",
      "accountName": "Main Cheque Account",
      "accountType": "Cheque",
      "balance": 12450.75,
      "availableBalance": 12200.00
    },
    {
      "accountNumber": "0987654321",
      "accountName": "Savings Account",
      "accountType": "Savings",
      "balance": 50000.00,
      "availableBalance": 50000.00
    }
  ],
  "lastUpdated": "2026-04-08T08:00:00Z"
}
```

---

## 💰 Cost Breakdown

### Free Option
- CSV Import: **Free** (manual, works with any bank)
- Recurring Transactions: **Free** (client-side reminders)
- Stitch Free Tier: **100 API calls/month** (manual refresh only)

### Paid Option (Full Features)
- Stitch Paid: **R500-1000/month** (unlimited API calls)
- Supabase Pro: **$25/month** (required for Edge Functions)
- **Total: ~R1500/month** for live balance + auto-sync

### Recommendation
Start with free tier:
- Use CSV import for bulk transactions
- Use recurring transactions for regular expenses
- Test Stitch with manual refresh (100 calls/month = ~3 per day)
- Upgrade if you need auto-sync every 5 minutes

---

## 🔧 Troubleshooting

### "R —" Still Showing
- Check if Stitch is connected
- Verify Edge Function is deployed
- Hard refresh browser (Ctrl+Shift+R)
- Check browser console for errors

### "Error" Displayed
- Check Supabase function logs
- Verify Stitch credentials are correct
- Reauthorize Nedbank if expired
- Check API usage limits

### Multiple Accounts Not Showing
- Ensure Stitch Edge Function is updated (latest version)
- Reauthorize Nedbank to grant access to all accounts
- Check Stitch Dashboard → Linked Accounts (should see all accounts)
- Test manually: `supabase functions invoke fetch-nedbank-transactions`

---

## 📖 Documentation Status

All guides are complete and ready to use:
- ✅ Setup instructions written
- ✅ Code fully implemented
- ✅ Multi-account support added
- ✅ Error handling in place
- ✅ Tested with single account (multi-account pending real data)

---

## 🎯 Next Steps

1. **Read SETUP-WALKTHROUGH.md** - Start the setup process
2. **Sign up for Stitch** - Create your account
3. **Connect Nedbank** - Link your accounts (one or many!)
4. **Deploy Function** - Get live balance working
5. **Enable Auto-Sync** - Turn on automatic updates

---

**Dashboard:** https://notmasemula.github.io/masemula-estate-dashboard/  
**Repository:** https://github.com/NotMasemula/masemula-estate-dashboard  
**Stitch:** https://stitch.money/  
**Supabase:** https://supabase.com/

---

*Last updated: 2026-04-08*
