# How to Bulk Upload (Import) Contacts to Google Sheets

Since you have the "Webhook" active, you can bulk upload thousands of contacts at once, and the system will process them all!

## ⚠️ CRITICAL RULE: Column Order
Your CSV or Excel file MUST have columns in this **EXACT order**:

1.  `first_name`
2.  `last_name`
3.  `email` (can be empty)
4.  `phone` (e.g. 080...)
5.  `birthday` (e.g. 15/01/1990)
6.  `notes` (optional)

If your file has different headers, **change them in Excel first** before uploading!

---

## Step-by-Step Import Guide

### 1. Open Your Sheet
Go to your Google Sheet where the script is running.

### 2. Start Import
1.  Click **File** (Top Left).
2.  Click **Import**.
3.  Click **Upload** tab.
4.  Drag your Excel or CSV file into the box.

### 3. Import Settings (VERY IMPORTANT)
A popup "Import file" will appear. Use these settings:

*   **Import location**: Select **"Append to current sheet"**.
    *   *Why?* This adds them to the bottom without deleting your headers!
*   **Separator type**: Detect automatically.
*   **Convert text to numbers, dates**: ✅ Check this.

### 4. Click "Import data"
Google will add all the rows to the bottom of your sheet.

### 5. Watch the Magic 🪄
The moment the rows appear:
1.  The Apps Script triggers automatically.
2.  It loops through every new row.
3.  It sends them to Supabase.
4.  You will see the **Status Column** turn Green (✅ Synced) for each row one by one.

---

## Pro Tip: Test with 5 Rows First
Before uploading 5,000 contacts:
1.  Make a small CSV with just 5 people.
2.  Import it.
3.  Check if they appear in your Dashboard.
4.  If it works, upload the rest!
