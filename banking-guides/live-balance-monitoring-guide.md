# Live Balance Monitoring Guide

## Overview
Your Masemula Estate Dashboard now has **live balance monitoring** that displays your Nedbank account balance in real-time on both the Dashboard and Finance tabs.

## Features

### 1. Dashboard Widget
- **Large gold-accented card** at the top of Dashboard showing current balance
- **One-click refresh button** to update balance on demand
- **Time-relative timestamps** (e.g., "Updated just now", "Updated 5 mins ago")
- Displays "R —" until Stitch is configured

### 2. Finance Tab — Live Balance Card
Located in **Finance → Overview**:
- **Current Balance**: Your account balance
- **Available Balance**: Funds available for transactions
- **Last Updated**: Timestamp of last sync
- **Recent Transactions**: Last 24 hours of activity

### 3. Auto-Refresh
- **Every 5 minutes**: Automatically refreshes when Stitch is configured
- **Manual refresh**: Click "🔄 Refresh Balance" anytime
- **Smart updates**: Only syncs when Stitch integration is active

## How It Works

### Data Flow
1. **User clicks "Refresh Balance"** (or auto-refresh triggers)
2. **Dashboard calls** `refreshLiveBalance()` function
3. **Function sends request** to Supabase Edge Function: `/functions/v1/fetch-nedbank-transactions`
4. **Edge Function calls Stitch API** to get latest balance from Nedbank
5. **Response includes**:
   - Current balance
   - Available balance
   - Account number
   - Transaction history
6. **Dashboard updates**:
   - Dashboard widget balance
   - Finance tab live balance card
   - Recent transactions list (last 24 hours)
7. **Data persisted** to localStorage as `liveBalanceData`

### Security
- **API keys** stored in Supabase environment variables (never in client code)
- **Stitch API** uses OAuth for read-only access to Nedbank
- **No credentials** stored in browser
- **HTTPS only** communication

## Setup Requirements

To enable live balance monitoring, you need to:

1. ✅ **Sign up for Stitch** at https://stitch.money/
2. ✅ **Connect your Nedbank account** (OAuth authorization)
3. ✅ **Get API credentials** from Stitch Dashboard
4. ✅ **Deploy Supabase Edge Function** with your API keys
5. ✅ **Enable auto-sync** by setting `stitchAutoSyncEnabled = true` in code

## Current State

### ✅ Implemented
- Live balance UI on Dashboard
- Live balance card in Finance → Overview
- Recent transactions display (last 24 hours)
- `refreshLiveBalance()` function with error handling
- Auto-refresh every 5 minutes
- Manual refresh button
- Time-relative timestamps
- Graceful fallback when Stitch not configured

### ⏳ Pending Setup
- Stitch account signup
- Nedbank account connection
- API key configuration
- Supabase Edge Function deployment

Until setup is complete, the dashboard will display:
- "R —" for balance
- "Not synced yet" for timestamp
- No recent transactions

## Testing the Feature

### Without Stitch (Current State)
1. Open Dashboard → See "R —" in balance card
2. Click "🔄 Refresh" → Alert: "Stitch not configured yet"
3. Navigate to Finance → Overview → Same "R —" display

### With Stitch (After Setup)
1. Open Dashboard → See actual balance (e.g., "R 12,450.75")
2. Click "🔄 Refresh" → Balance updates with loading state
3. Check timestamp → "Updated just now"
4. Navigate to Finance → Overview → See detailed breakdown
5. Wait 5 minutes → Balance auto-refreshes

## Technical Details

### Functions Added
- `refreshLiveBalance()`: Main function to fetch and update balance
- `renderLiveBalance()`: Updates all UI elements with balance data
- `renderRecentTransactions()`: Displays last 24 hours of transactions

### Data Structure
```javascript
liveBalanceData = {
  balance: 12450.75,           // Current balance
  availableBalance: 12200.00,  // Available funds
  accountNumber: "1234567890", // Nedbank account number
  lastUpdated: "2024-01-15T10:30:00Z" // ISO timestamp
}
```

### Auto-Refresh Logic
```javascript
// Every 5 minutes
setInterval(async () => {
  if (liveBalanceData && stitchAutoSyncEnabled) {
    await refreshLiveBalance();
  }
}, 300000);
```

### Error Handling
- Network errors: Shows "Error" in red
- 404 errors: Alert with setup instructions
- Timeout errors: Graceful fallback to cached data

## Next Steps

To activate live balance monitoring:

1. **Read**: `stitch-nedbank-integration-guide.md`
2. **Read**: `supabase-deployment-guide.md`
3. **Complete**: Stitch signup and Nedbank connection
4. **Deploy**: Supabase Edge Function with API keys
5. **Enable**: Set `stitchAutoSyncEnabled = true` in `index.html`
6. **Test**: Click refresh button to see live balance

---

## Troubleshooting

### "R —" not updating
- Check Stitch account is connected
- Verify Edge Function is deployed
- Check browser console for errors
- Try manual refresh

### "Error" displayed
- Check Supabase Edge Function logs
- Verify Stitch API keys are correct
- Check Nedbank account is still linked
- Confirm internet connection

### Auto-refresh not working
- Verify `stitchAutoSyncEnabled = true`
- Check browser console for errors
- Ensure page hasn't been idle too long
- Try manual refresh first

---

**Status**: ✅ Code complete, awaiting Stitch setup
**Deployed**: https://notmasemula.github.io/masemula-estate-dashboard/
**Last updated**: 2024-01-15
