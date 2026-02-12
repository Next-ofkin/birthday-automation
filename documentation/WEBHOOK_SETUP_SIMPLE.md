# Google Sheets Webhook Setup (Simple)

## The Difference Between The Two Approaches:

### ❌ OLD WAY (Scheduled Polling):
- System "wakes up" every night at 2 AM
- Downloads ENTIRE Google Sheet
- Checks for changes
- **Problem**: Wastes resources even when nothing changed

### ✅ NEW WAY (Webhook - Event Driven):
- You edit a row in Google Sheets
- Google Sheet **immediately** tells your system
- System only processes that ONE contact
- **Benefit**: No wasted work. Both systems only wake when there's a job!

---

## Setup (3 Steps):

### Step 1: Get Your Service Key
1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Find **service_role** key (secret) and copy it
3. Keep it safe!

### Step 2: Setup Google Sheet Script
1. Open your Google Sheet with contacts
2. Click **Extensions** → **Apps Script**
3. Delete any existing code
4. Copy ALL the code from `google-sheets-webhook.gs` and paste it
5. **Line 20**: Replace `YOUR_SERVICE_ROLE_KEY_HERE` with the key from Step 1
6. **Line 21**: Change `'Sheet1'` to your actual sheet name (if different)
7. Click **Save** (💾 icon)
8. Google will ask for permissions - Click **Review Permissions** → **Allow**

### Step 3: Test It!
1. In your Google Sheet, add a new contact row:
   ```
   John | Doe | john@test.com | 08012345678 | 15/01/1990 | Test contact
   ```
2. Wait 2 seconds
3. Check your **Contacts** page - John Doe should appear! ✨

---

## Your Column Names MUST Be:
- `first_name`
- `last_name`
- `email` (optional)
- `phone` (required)
- `birthday` (required - use DD/MM/YYYY format)
- `notes` (optional)

---

## How It Works:
```
You edit Google Sheet
    ↓
Google Apps Script detects change (onEdit trigger)
    ↓
Sends contact data to Supabase
    ↓
Contact appears in your system
```

Both systems are "sleeping" until you edit the sheet!
