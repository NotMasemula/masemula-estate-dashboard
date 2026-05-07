# Data Capture Analysis: Masemula Estate Dashboard

## Overview
The dashboard captures data across 9 major sections with different storage strategies:
1. **Local-first approach** — Data saved locally immediately
2. **Debounced cloud sync** — Batched upload after 1 second of inactivity
3. **Graceful offline mode** — Works without internet
4. **Real-time listeners** — Auto-refresh when other devices change data

---

## Data Capture Flow

### High-Level Architecture

```
User Input
    ↓
Validation (client-side)
    ↓
Save to Memory (cloudStore)
    ↓
Update UI (re-render)
    ↓
Debounced Cloud Sync (1s delay)
    ↓
Supabase REST API (or offline queue)
    ↓
Real-time Listener (other devices notified)
```

### Core Functions

#### 1. **saveData(key, value)** — Universal Save Function
```javascript
async function saveData(key, value) {
  cloudStore[key] = value;  // 1. Save to memory immediately
  
  if (!syncEnabled || isSyncing) {
    console.log(`💾 Saved "${key}" in memory`);
    return;
  }
  
  // 2. Queue sync after 1 second (debounced)
  clearTimeout(window['saveTimeout_' + key]);
  window['saveTimeout_' + key] = setTimeout(() => syncToCloud(false), 1000);
}
```

**Why debounce?**
- If user adds 5 transactions quickly, only 1 sync to cloud (not 5)
- Reduces network traffic and Supabase API calls
- Prevents flickering if sync is slow

#### 2. **loadData(key, fallback)** — Universal Load Function
```javascript
function loadData(key, fallback = null) {
  if (cloudStore[key] !== undefined) {
    return cloudStore[key];  // Load from in-memory cache
  }
  return fallback;  // Return default if not found
}
```

**Why in-memory?**
- Instant load (no re-parsing JSON)
- All data in one place (cloudStore)
- Easier to sync multiple tables at once

#### 3. **syncToCloud(showFeedback)** — Push to Supabase
```javascript
async function syncToCloud(showFeedback = false) {
  // Pushes all data from cloudStore to Supabase
  // Called automatically on saveData() debounce
  // Called manually when user clicks "↻ Sync" button
  // Merges local + cloud data intelligently
}
```

#### 4. **loadFromCloud(showFeedback)** — Pull from Supabase
```javascript
async function loadFromCloud(showFeedback = false) {
  // Fetches all data from Supabase
  // Called on page load
  // Called when user clicks "↻ Sync" button
  // Updates all sections simultaneously
}
```

---

## Data Capture by Section

### 1. **Finance** (Ledger, Recurring, Goals, Investments)

#### Ledger Entry Capture
```javascript
async function addLedgerEntry(type) {
  // 1. Get form values
  const desc = document.getElementById(type+'-desc').value.trim();
  const amt = parseFloat(document.getElementById(type+'-amt').value);
  const cat = document.getElementById(type+'-cat').value;
  
  // 2. Validate
  if (!desc || isNaN(amt) || amt <= 0) {
    showToast('Enter description and amount', true);
    return;
  }
  
  // 3. Create entry with timestamp
  ledger.unshift({
    type,      // 'income' or 'expense'
    desc,      // "Shopify sale"
    amt,       // 1500.50
    cat,       // "Dropshipping"
    date: new Date().toISOString()
  });
  
  // 4. Save to cloud
  await saveData('financeLedger', ledger);
  
  // 5. Clear form
  descEl.value = '';
  amtEl.value = '';
  
  // 6. Re-render UI
  renderLedger();
  updateFinanceTotals();
}
```

**Storage:**
- Key: `financeLedger`
- Type: Array of transaction objects
- Sync: Debounced (1s)
- Cloud table: `masemula_estate` (JSON column)

#### Recurring Transaction Capture
```javascript
async function addRecurringTransaction() {
  const amount = document.getElementById('recurring-amount').value;
  const frequency = document.getElementById('recurring-freq').value;
  const description = document.getElementById('recurring-desc').value;
  
  // Validation
  if (!amount || !description) {
    showToast('Fill all fields', true);
    return;
  }
  
  // Create entry with tracking
  recurringTransactions.push({
    id: Date.now(),
    amount: parseFloat(amount),
    frequency,  // 'daily', 'weekly', 'monthly'
    description,
    lastProcessed: null,  // For duplicate prevention
    createdDate: new Date().toISOString()
  });
  
  await saveData('recurringTransactions', recurringTransactions);
  renderRecurringTransactions();
}
```

**Storage:**
- Key: `recurringTransactions`
- Type: Array of recurring transaction objects
- Smart duplicate prevention: Tracks `lastProcessed` date
- Cloud table: `masemula_estate`

---

### 2. **Time & Routine** (Habits, Daily Schedule)

#### Habit Tracking Capture
```javascript
async function toggleHabit(habitKey, date) {
  // 1. Get the habit data for this date
  const habitData = weekData[habitKey] || [];
  const dayIndex = habitData.findIndex(d => d === date);
  
  // 2. Toggle (add or remove from array)
  if (dayIndex >= 0) {
    habitData.splice(dayIndex, 1);  // Remove (unchecked)
  } else {
    habitData.push(date);  // Add (checked)
  }
  
  // 3. Save week data
  await saveData(getWeekKey(), weekData);
  
  // 4. Re-render
  renderRoutineHabits();
}
```

**Storage:**
- Key: `routine-week-YYYY-WW` (date-based)
- Type: Object with habit keys mapping to boolean arrays
- Sync: Debounced
- Cloud table: `masemula_estate`

---

### 3. **Academics** (Module Marks)

#### Mark Entry Capture
```javascript
async function saveMark(code, assessment, val) {
  // 1. Find or create module
  let mod = moduleMarks.find(m => m.code === code);
  if (!mod) {
    mod = { code, name: code, marks: {} };
    moduleMarks.push(mod);
  }
  
  // 2. Update mark
  mod.marks[assessment] = parseFloat(val);
  
  // 3. Save
  await saveData('moduleMarks', moduleMarks);
  
  // 4. Re-render with percentage calculation
  renderModuleMarks();
}
```

**Storage:**
- Key: `moduleMarks`
- Type: Array of module objects with marks
- Sync: Immediate (academic data is critical)
- Cloud table: `masemula_estate`

---

### 4. **Headspace** (Journal, Emotions)

#### Journal Entry Capture
```javascript
async function saveJournalEntry() {
  // 1. Get form values
  const question = document.getElementById('journal-q').value.trim();
  const answer = document.getElementById('journal-a').value.trim();
  
  // 2. Validate
  if (!answer) {
    showToast('Please write something', true);
    return;
  }
  
  // 3. Create entry
  journal.unshift({
    date: new Date().toISOString(),
    question,
    answer,
    mood: null  // Optional mood tag
  });
  
  // 4. Save
  await saveData('journalDiary', journal);
  
  // 5. Clear and re-render
  document.getElementById('journal-a').value = '';
  renderJournalDiary();
}
```

**Storage:**
- Key: `journalDiary`
- Type: Array of journal entries
- Sensitive: Personal reflections
- Sync: Debounced
- Cloud table: `masemula_estate` (RLS enforces user isolation)

#### Emotion Log Capture
```javascript
async function logEmotion() {
  const emotion = document.getElementById('emotion-select').value;
  const intensity = document.getElementById('emotion-intensity').value;
  const note = document.getElementById('emotion-note').value.trim();
  
  emotionLog.unshift({
    date: new Date().toISOString(),
    emotion,    // 'happy', 'anxious', 'focused', etc
    intensity,  // 1-10 scale
    note
  });
  
  await saveData('emotionLog', emotionLog);
  renderEmotionLog();
}
```

---

### 5. **Goals** (Milestones, Task Links)

#### Goal Creation Capture
```javascript
async function submitNewGoal() {
  // 1. Get form values
  const title = document.getElementById('goal-title').value.trim();
  const category = document.getElementById('goal-category').value;
  const target = parseFloat(document.getElementById('goal-target').value);
  const unit = document.getElementById('goal-unit').value;
  const deadline = document.getElementById('goal-deadline').value;
  const source = document.getElementById('goal-source').value;
  
  // 2. Validate
  if (!title || isNaN(target)) {
    showToast('Fill all required fields', true);
    return;
  }
  
  // 3. Create goal
  goals.push({
    id: Date.now(),
    title,
    category,
    target,
    unit,
    deadline,
    source,      // Manual or auto-tracked from finance/ventures
    milestones: [],
    progress: 0,
    createdDate: new Date().toISOString()
  });
  
  // 4. Save
  await saveData('goals', goals);
  
  // 5. Close modal and re-render
  closeGoalModal();
  renderGoals();
}
```

**Storage:**
- Key: `goals`
- Type: Array of goal objects
- Linked to: Finance data (for auto-tracking)
- Sync: Debounced
- Cloud table: `masemula_estate`

---

### 6. **Ventures** (Projects, Shared Ventures)

#### Personal Project Capture
```javascript
async function addPersonalProject() {
  // 1. Get form values
  const name = document.getElementById('project-name').value.trim();
  const desc = document.getElementById('project-desc').value.trim();
  const status = document.getElementById('project-status').value;
  const category = document.getElementById('project-category').value;
  
  // 2. Validate
  if (!name) {
    showToast('Please enter a project name', true);
    return;
  }
  
  // 3. Create project
  personalProjects.push({
    id: Date.now(),
    name,
    desc,
    status,      // 'planning', 'active', 'paused', 'completed'
    category,    // 'business', 'music', 'brand', etc
    createdDate: new Date().toISOString(),
    updatedDate: new Date().toISOString()
  });
  
  // 4. Save to cloud immediately (full sync for critical data)
  await saveData('personalProjects', personalProjects);
  await syncToCloud();  // Force immediate sync
  
  // 5. Clear and re-render
  document.getElementById('project-name').value = '';
  document.getElementById('project-desc').value = '';
  renderPersonalProjects();
}
```

**Storage:**
- Key: `personalProjects`
- Type: Array of project objects
- Sync: Full sync immediately (CRUD operations)
- Cloud table: Supabase `personal_items` table (full REST integration)

#### Shared Venture Capture
```javascript
async function addSharedVenture() {
  svData.ventures.push({
    id: Date.now(),
    name,
    description,
    stage,        // 'idea', 'planning', 'capital', 'active'
    ntobeko_split: 50,  // Default 50/50
    tshegofatso_split: 50,
    createdDate: new Date().toISOString()
  });
  
  await svSaveToCloud();  // Special sync for shared ventures
}
```

**Storage:**
- Key: `masemula-ventures-shared` (special)
- Type: Shared venture data (both partners can edit)
- Sync: Manual `svSaveToCloud()` (PATCH then INSERT pattern)
- Cloud table: `masemula_estate` (row with user_id = USER_ID)
- Security: RLS ensures only authorized partners can see

---

### 7. **Vision Board** (Design Uploads)

#### Design/Image Upload Capture
```javascript
async function handleVisionImageUpload() {
  const file = document.getElementById('vision-image').files[0];
  
  if (!file) {
    showToast('Please select an image', true);
    return;
  }
  
  // 1. Upload to Supabase Storage
  const path = `${USER_ID}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await sbClient.storage
    .from('vision-board')
    .upload(path, file, { upsert: false });
  
  if (uploadError) {
    showToast('Upload failed: ' + uploadError.message, true);
    return;
  }
  
  // 2. Get public URL
  const { data: urlData } = sbClient.storage
    .from('vision-board')
    .getPublicUrl(path);
  
  // 3. Save metadata to database
  const { error: insertError } = await sbClient
    .from('vision_board')
    .insert({
      owner_uid: 'masemula-estate-dashboard',  // Dashboard key
      title: file.name.split('.')[0],
      caption: '',
      storage_path: path,
      position_order: 0
    });
  
  if (insertError) {
    showToast('Save failed: ' + insertError.message, true);
    return;
  }
  
  // 4. Reload designs
  await loadDesignsFromSupabase();
}
```

**Storage:**
- File: Supabase Storage (`vision-board` bucket)
- Metadata: Supabase `vision_board` table
- Path format: `${USER_ID}/${timestamp}-${filename}`
- Cloud sync: Immediate (REST API call)

---

## Data Validation

### Client-Side Validation

**Common Checks:**
```javascript
// Required field
if (!value.trim()) {
  showToast('Field is required', true);
  return;
}

// Numeric validation
if (isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
  showToast('Enter a valid amount', true);
  return;
}

// Date validation
if (!validDate(dateString)) {
  showToast('Invalid date format', true);
  return;
}

// Length validation
if (value.length > 100) {
  showToast('Text too long (max 100 chars)', true);
  return;
}
```

### No Server-Side Validation
⚠️ **Note:** Currently all validation is client-side only.
- Supabase RLS policies enforce data access
- No CHECK constraints on data format
- No triggers to validate on insert

**Recommendation:** Add server-side validation for critical data (finance, goals)

---

## Data Sync Strategy

### Offline-First
- Data saved to memory immediately
- Cloud sync is optional (not blocking)
- App works without internet

### Debounced Sync
- Multiple edits → single API call
- 1-second delay between last edit and sync
- Configurable debounce time

### Merge on Conflict
- Cloud data compared with local
- Timestamps determine winner
- Last-write-wins strategy

### Real-Time Updates
```javascript
// Listen for changes from other devices
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'masemula_estate',
  filter: `user_id=eq.${USER_ID}`
}, async () => {
  await loadFromCloud();  // Auto-refresh
  renderAllSections();
})
```

---

## Storage Summary

| Section | Data Type | Storage Key | Cloud Table | Sync Type |
|---------|-----------|------------|------------|-----------|
| **Finance** | Ledger, Goals, Recurring, Investments | financeLedger, ... | masemula_estate | Debounced (1s) |
| **Routine** | Habits, Daily Schedule, Notes | routine-week-* | masemula_estate | Debounced |
| **Academics** | Module Marks | moduleMarks | masemula_estate | Debounced |
| **Headspace** | Journal, Emotions | journalDiary, emotionLog | masemula_estate | Debounced |
| **Goals** | Milestones, Tasks | goals | masemula_estate | Debounced |
| **Ventures** | Projects | personalProjects | personal_items (REST) | Immediate |
| **Shared Ventures** | Partnership Data | masemula-ventures-shared | masemula_estate | Manual |
| **Vision Board** | Images + Metadata | vision_board table | vision_board table + Storage | Immediate |
| **Preferences** | Theme, Settings | user_preferences | user_preferences table | UPSERT |

---

## Data Capture Improvements

### ✅ Currently Working
- Immediate local feedback (no UI lag)
- Offline mode enabled
- Cross-device sync via real-time listeners
- User validation with helpful error messages
- Debounced cloud sync (efficient)

### ⚠️ Could Be Improved

1. **Server-Side Validation**
   - Add Supabase functions to validate data format
   - Example: Amount > 0, valid dates, text length

2. **Duplicate Prevention**
   - Currently relies on user not clicking twice
   - Could add debounce to buttons (disable after click)

3. **Optimistic Updates**
   - Show change immediately (works now)
   - But don't show success until cloud confirms (could add)

4. **Conflict Resolution**
   - Current: Last-write-wins
   - Better: Show user choice if same field edited on two devices

5. **Undo/Redo**
   - No way to undo accidental data entry
   - Could implement undo stack (local only)

6. **Audit Trail**
   - No record of who changed what, when
   - Could log edits for accountability

7. **Batch Uploads**
   - Currently syncs entire dataset
   - Could sync only changed fields (more efficient)

---

## Testing Data Capture

### Manual Testing Checklist
- [ ] Add entry online → Appears in cloud
- [ ] Add entry offline → Appears when coming back online
- [ ] Edit entry on Device A → Refresh Device B → See change
- [ ] Delete entry → Sync → Gone on all devices
- [ ] Rapid adds (5+ in 1 sec) → Only 1 API call
- [ ] Form validation → Error message shows
- [ ] Empty form submit → Prevented

### Edge Cases
- [ ] Add while cloud sync is running
- [ ] Network timeout mid-sync
- [ ] Duplicate submit (click button twice)
- [ ] Invalid input (letters in amount field)
- [ ] Storage quota exceeded (for file uploads)

---

## Next Steps

1. **Add Server-Side Validation**
   - Supabase functions to check data format
   - Prevent invalid data from being stored

2. **Implement Button Debounce**
   - Disable button after click (1s timeout)
   - Prevent duplicate submissions

3. **Add Undo Feature**
   - Keep last 10 actions in memory
   - Allow user to undo recent changes

4. **Audit Logging**
   - Track all data changes
   - Show change history

5. **Batch Sync**
   - Only send changed fields
   - Reduce API call payload size

---

## Code Locations

| Feature | File | Lines |
|---------|------|-------|
| saveData() | index.html | ~2500 |
| loadData() | index.html | ~2510 |
| syncToCloud() | index.html | ~2550 |
| loadFromCloud() | index.html | ~2600 |
| Finance capture | index.html | ~3200-3400 |
| Routine capture | index.html | ~5500-5700 |
| Goals capture | index.html | ~3700-3800 |
| Vision upload | index.html | ~6850-6900 |

