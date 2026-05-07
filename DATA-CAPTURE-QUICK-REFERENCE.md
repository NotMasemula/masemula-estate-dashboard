# Data Capture Quick Reference

## How Data Flows Through the Dashboard

### Step-by-Step Example: Adding a Finance Entry

```
1. User enters amount, description, category
           ↓
2. Client-side validation checks:
   - Amount > 0?
   - Description not empty?
   - Category selected?
           ↓
3. Save to memory immediately:
   cloudStore['financeLedger'] = [new entry, ...old entries]
           ↓
4. UI updates instantly (re-render ledger list)
           ↓
5. Start 1-second debounce timer for cloud sync
           ↓
6. If user adds another entry within 1 second:
   - Previous timer is cancelled
   - New 1-second timer starts
   - But only 1 API call will be made
           ↓
7. After 1 second of no new edits:
   - Call syncToCloud()
   - POST entire cloudStore to Supabase
           ↓
8. Real-time listener detects change:
   - On other device, loadFromCloud() is called
   - UI refreshes automatically
           ↓
9. Cross-device sync complete!
```

---

## Data Storage by Section

### Quick Lookup Table

```
FINANCE
├─ Ledger Entries
│  └─ Storage: cloudStore['financeLedger']
│     Synced to: masemula_estate table
│     Example: { type: 'expense', desc: 'Groceries', amt: 250, cat: 'Living', date: '2024-05-07T...' }
│
├─ Recurring Transactions
│  └─ Storage: cloudStore['recurringTransactions']
│     Synced to: masemula_estate table
│     Example: { id: 1234, amount: 5000, frequency: 'monthly', description: 'Rent', lastProcessed: null }
│
├─ Savings Goals
│  └─ Storage: cloudStore['savingsGoals']
│     Synced to: masemula_estate table
│
└─ Investments
   └─ Storage: cloudStore['investments']
      Synced to: masemula_estate table

TIME & ROUTINE
├─ Weekly Habits
│  └─ Storage: cloudStore['routine-week-2024-W19']
│     Synced to: masemula_estate table
│     Example: { gym: [true, false, true, ...], sleep: [true, true, ...] }
│
├─ Daily Schedule
│  └─ Storage: cloudStore['routine-schedule-2024-05-07']
│     Synced to: masemula_estate table
│
└─ Routine Notes
   └─ Storage: cloudStore['routine-note-2024-05-07']
      Synced to: masemula_estate table

ACADEMICS
└─ Module Marks
   └─ Storage: cloudStore['moduleMarks']
      Synced to: masemula_estate table
      Example: [{ code: 'CS101', name: 'Intro to CS', marks: { test1: 85, test2: 90, exam: 88 } }]

HEADSPACE
├─ Journal Entries
│  └─ Storage: cloudStore['journalDiary']
│     Synced to: masemula_estate table
│     Example: { date: '2024-05-07T...', question: 'How are you?', answer: 'Feeling good...', mood: null }
│
└─ Emotion Log
   └─ Storage: cloudStore['emotionLog']
      Synced to: masemula_estate table
      Example: { date: '2024-05-07T...', emotion: 'focused', intensity: 8, note: 'Deep work session' }

GOALS
└─ Goals with Milestones
   └─ Storage: cloudStore['goals']
      Synced to: masemula_estate table
      Example: { id: 1234, title: 'Build app', category: 'business', target: 100, unit: 'hrs', deadline: '2024-06-01', milestones: [...], progress: 45 }

VENTURES
├─ Personal Projects
│  └─ Storage: cloudStore['personalProjects']
│     Synced to: personal_items table (REST API, FULL SYNC)
│     Example: { id: 1234, name: 'Music Producer', desc: '...', status: 'active', category: 'music' }
│
└─ Shared Ventures
   └─ Storage: cloudStore['masemula-ventures-shared']
      Synced to: masemula_estate table (manual svSaveToCloud())
      Owned by: Both Ntobeko (8cfd23ed...) and Tshegofatso (partner UUID)
      Example: { ventures: [...], transactions: [...], settlements: [...] }

VISION BOARD
├─ Image Files
│  └─ Storage: Supabase Storage (vision-board bucket)
│     Path: ${USER_ID}/${timestamp}-${filename}
│
└─ Image Metadata
   └─ Storage: vision_board table (REST API, immediate sync)
      Columns: id, owner_uid, title, caption, storage_path, position_order, created_at
      Example: { owner_uid: 'masemula-estate-dashboard', title: 'Design 1', storage_path: '8cfd23ed.../1234567890-design.png' }

USER PREFERENCES
└─ Theme & Settings
   └─ Storage: user_preferences table (REST API, UPSERT)
      Columns: id, owner_uid, dark_mode, created_at
      Example: { owner_uid: '8cfd23ed-...', dark_mode: true }
```

---

## Save Functions by Section

### Finance
```javascript
saveData('financeLedger', ledger)
saveData('recurringTransactions', recurringTransactions)
saveData('savingsGoals', savingsGoals)
saveData('investments', investments)
```

### Time & Routine
```javascript
saveData(getWeekKey(), weekData)           // e.g., 'routine-week-2024-W19'
saveData(getDayKey(), dayData)             // e.g., 'routine-day-2024-05-07'
saveData('routine-note-' + dateKey, note)
```

### Academics
```javascript
saveData('moduleMarks', moduleMarks)
```

### Headspace
```javascript
saveData('journalDiary', journal)
saveData('emotionLog', emotionLog)
```

### Goals
```javascript
saveData('goals', goals)
```

### Ventures
```javascript
saveData('personalProjects', personalProjects)  // Then syncToCloud() immediately
saveData('masemula-ventures-shared', svData)    // Then svSaveToCloud()
```

### Vision Board
```javascript
sbClient.storage.from('vision-board').upload(path, file)  // Upload to storage
sbClient.from('vision_board').insert({ ... })            // Save metadata
```

### Preferences
```javascript
sbClient.from('user_preferences').upsert({ owner_uid: USER_ID, dark_mode: next })
```

---

## Sync Triggers

### Automatic Sync (Debounced 1 second)
```javascript
await saveData('key', value);  // Internally triggers sync after 1s
```

### Manual Sync (User Button Click)
```javascript
await manualSync();  // User clicks "↻ Sync" button
```

### Real-Time Sync (Other Device Changed Data)
```javascript
.on('postgres_changes', { ... }, async () => {
  await loadFromCloud();
  renderAllSections();
})
```

### Immediate Sync (Critical Data)
```javascript
await saveData('personalProjects', personalProjects);
await syncToCloud();  // Don't wait for debounce
```

---

## Data Validation Rules

### Finance
| Field | Rule | Example |
|-------|------|---------|
| Amount | Must be > 0 | 250.50 ✓ |
| Description | Required, not empty | "Groceries" ✓ |
| Category | Must be selected | "Living" ✓ |
| Date | ISO format | 2024-05-07T10:30:00Z ✓ |

### Routine
| Field | Rule | Example |
|-------|------|---------|
| Habit value | Boolean or number | true or 2.5 ✓ |
| Date | Valid date | 2024-05-07 ✓ |
| Notes | Optional, any text | "Good day" ✓ |

### Academics
| Field | Rule | Example |
|-------|------|---------|
| Code | Required, alphanumeric | "CS101" ✓ |
| Mark | 0-100 | 85 ✓ |

### General
| Rule | Check |
|------|-------|
| Required fields | Trim and validate not empty |
| Numeric fields | parseFloat() and isNaN() check |
| Dates | Valid date format check |
| Length limits | Trim and check length |

---

## Troubleshooting Data Capture

### "Data not saving"
1. Check Network tab for POST to `/rest/v1/masemula_estate`
2. Look for 403 or 400 errors (permission or validation)
3. Check if syncEnabled = true
4. Wait 1 second (debounce timer)

### "Data not appearing on other device"
1. Check real-time listener (should show `ws://` connection)
2. Refresh the other device
3. Check if both devices use same user UUID (USER_ID)
4. Verify RLS policies allow read access

### "Form validation not working"
1. Check browser console for errors
2. Verify form field IDs match JavaScript
3. Ensure input elements are text/number type

### "Upload failing"
1. Check file size (should be < 10MB)
2. Verify file is image format
3. Check Storage bucket permissions
4. Look for 413 (file too large) or 403 (permission) errors

---

## Performance Tips

### For Users
1. **Batch edits** — Add multiple items, then sync (faster)
2. **Offline mode** — App works without internet
3. **Auto-sync** — Edits sync automatically after 1 second

### For Developers
1. **Debounce** — Don't debounce critical data (goals, finance)
2. **Real-time** — Use listeners for cross-device updates
3. **Cache** — In-memory cloudStore is fast
4. **Merge** — Last-write-wins strategy is simple but works

---

## Data Security

### What's Protected
- ✅ User data isolated by UUID (RLS)
- ✅ Shared venture data accessible only to partners
- ✅ Vision board files in private storage bucket
- ✅ Theme preferences tied to user account

### What's Not Protected
- ❌ Client-side validation only (could be bypassed)
- ❌ No server-side validation of data format
- ❌ No audit trail of changes
- ❌ No encryption at rest

### Recommendations
1. Add server-side validation (Supabase functions)
2. Enable Supabase audit logging
3. Add data encryption for sensitive fields
4. Implement role-based access for shared data

---

## File Locations

| Component | File | Lines |
|-----------|------|-------|
| Core sync functions | index.html | 2500-2650 |
| saveData() | index.html | ~2500 |
| loadData() | index.html | ~2515 |
| syncToCloud() | index.html | ~2550 |
| loadFromCloud() | index.html | ~2600 |
| Finance capture | index.html | 3100-3400 |
| Routine capture | index.html | 5500-5700 |
| Academics capture | index.html | 3950-4050 |
| Headspace capture | index.html | 3500-3700 |
| Goals capture | index.html | 3700-3900 |
| Ventures capture | index.html | 5800-6200 |
| Vision upload | index.html | 6850-6950 |

---

## Next Steps

1. **Enhance Validation**
   - Add server-side checks via Supabase functions
   - Validate amount > 0 on server
   - Check date format on server

2. **Add Confirmations**
   - Show "Saved to cloud" toast after sync
   - Show pending status while syncing
   - Show error toast if sync fails

3. **Prevent Duplicates**
   - Disable submit button after click (1s)
   - Show loading state during submission

4. **Add Undo**
   - Keep undo stack (last 10 actions)
   - Implement Ctrl+Z for undo

5. **Audit Trail**
   - Log all changes with timestamp
   - Show "Last edited by" info
   - Track who made changes when
