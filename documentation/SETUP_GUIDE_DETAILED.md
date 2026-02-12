# Complete Webhook Setup Guide (Step-by-Step)

## What You're Building:
When you add/edit a contact in Google Sheets → It automatically appears in your Birthday System!

---

## STEP 1: Get Your Supabase Secret Key 🔑

1. Open your browser and go to: https://supabase.com/dashboard
2. Click on your **Birthday Automation** project
3. On the left menu, click **⚙️ Settings**
4. Click **API**
5. Scroll down to **Project API keys**
6. Find the one labeled **`service_role`** (it says "secret")
7. Click the **👁️ eye icon** to reveal it
8. Click **📋 Copy** button
9. **Paste it in Notepad** - you'll need it in Step 3

**IMPORTANT**: This is a SECRET key. Don't share it!

---

## STEP 2: Prepare Your Google Sheet 📊

### 2a. Open Your Google Sheet
- Go to https://sheets.google.com
- Open the sheet where you keep contacts
- OR create a new one

### 2b. Setup Column Names (MUST BE EXACT!)
Your first row (header row) must have EXACTLY these names:

| first_name | last_name | email            | phone       | birthday   | notes  |
| ---------- | --------- | ---------------- | ----------- | ---------- | ------ |
| John       | Doe       | john@example.com | 08012345678 | 15/01/1990 | Friend |

**Column names MUST be**:
- `first_name` (required)
- `last_name` (required)
- `email` (optional - can be empty)
- `phone` (required - Nigerian format: 0801...)
- `birthday` (required - format: DD/MM/YYYY like 15/01/1990)
- `notes` (optional - can be empty)

### 2c. Check Your Sheet Name
- Look at the bottom of your Google Sheet
- You'll see a tab name (default is "Sheet1")
- **Remember this name** - you'll need it in Step 3

---

## STEP 3: Add The Magic Script 🪄

### 3a. Open Apps Script Editor
1. In your Google Sheet, click **Extensions** (top menu)
2. Click **Apps Script**
3. A new tab will open with code editor

### 3b. Clear Old Code
- If you see any code, **select ALL** (Ctrl+A)
- **Delete** it

### 3c. Copy The New Code
1. Go back to VS Code
2. Open the file: `google-sheets-webhook.gs`
3. **Select ALL the code** (Ctrl+A)
4. **Copy** (Ctrl+C)

### 3d. Paste The Code
1. Go back to the Apps Script tab
2. **Paste** the code (Ctrl+V)

### 3e. Update The Code (2 Changes)
Find Line 20 (it says `SERVICE_ROLE_KEY: 'YOUR_SERVICE_ROLE_KEY_HERE'`)
- Replace `YOUR_SERVICE_ROLE_KEY_HERE` with the key you copied in **Step 1**
- Keep the quotes! Like: `SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1...'`

Find Line 21 (it says `SHEET_NAME: 'Sheet1'`)
- If your sheet is NOT named "Sheet1", change it
- Example: If your sheet is "Contacts", write: `SHEET_NAME: 'Contacts'`

### 3f. Save The Script
1. Click the **💾 Save** icon (or press Ctrl+S)
2. Give it a name: "Birthday Webhook" → Click **OK**

---

## STEP 4: Grant Permissions ✅

**Google will ask for permission. This is normal!**

1. Click **Run** (▶️ play button at the top)
2. Choose the function: **testWebhook**
3. Click **Run** again
4. A popup appears: **"Authorization required"**
5. Click **Review Permissions**
6. **Choose your Google account**
7. Google says "This app isn't verified" - **Click "Advanced"**
8. Click **"Go to Birthday Webhook (unsafe)"** (it's safe, it's YOUR code!)
9. Click **Allow**

---

## STEP 5: Test It! 🎉

### Method 1: Automatic Test
1. In Apps Script editor, make sure **testWebhook** is selected
2. Click **Run** (▶️)
3. Click **View** → **Logs**
4. You should see: ✅ Test complete
5. Go to your **Birthday System → Contacts page**
6. Look for "Test User" - it should be there!

### Method 2: Real Test
1. Go back to your Google Sheet
2. Add a new row with real data:
   ```
   Emmanuel | Shogbola | e.shogbola@example.com | 08012345678 | 15/01/1990 | Testing webhook
   ```
3. Wait 3 seconds
4. Go to your **Birthday System → Contacts**
5. **Emmanuel Shogbola** should appear! ✨

---

## ✅ You're Done! 

Now whenever you:
- Add a new row in Google Sheets
- Edit an existing row

The contact will **automatically** sync to your system within seconds!

---

## Troubleshooting

**Problem**: Nothing happens when I add a row
- Check: Did you grant permissions in Step 4?
- Check: Are your column names EXACTLY correct? (lowercase, underscores)
- Check: Did you save the script? (Step 3f)

**Problem**: "Unauthorized" error
- Check: Did you paste the correct SERVICE_ROLE_KEY in Step 3e?

**Problem**: "Sheet not found"
- Check: SHEET_NAME in line 21 matches your actual sheet name

---

## How to View Logs (For Debugging)

1. Go to Apps Script editor
2. Click **View** → **Logs** or **View** → **Executions**
3. You'll see what happened each time the script ran
