/**
 * Google Sheets to Supabase Webhook
 * 
 * This script automatically sends new/updated contact data to your Supabase system
 * whenever you add or edit a row in Google Sheets.
 * 
 * Setup Instructions:
 * 1. Open your Google Sheet
 * 2. Go to Extensions → Apps Script
 * 3. Delete any existing code
 * 4. Paste this entire script
 * 5. Replace YOUR_SUPABASE_FUNCTION_URL and YOUR_SERVICE_ROLE_KEY below
 * 6. Save (Ctrl+S)
 * 7. Grant permissions when prompted
 * 
 * Now whenever you add/edit a row, it sends to Supabase automatically!
 */

// ==================== CONFIGURATION ====================
const CONFIG = {
  SUPABASE_FUNCTION_URL: 'https://isswlcllytiltgjbysjv.supabase.co/functions/v1/sync-google-sheets-webhook',
  SERVICE_ROLE_KEY: 'YOUR_SERVICE_ROLE_KEY_HERE',  // Get from Supabase → Settings → API
  SHEET_NAME: 'Sheet1'  // Change if your sheet has a different name
}

// ==================== MAIN TRIGGER ====================
/**
 * @OnlyCurrentDoc
 * This function runs automatically when you edit the sheet
 * WE RENAMED IT from 'onEdit' to 'handleEdit' to avoid the "Simple Trigger" error.
 */
function handleEdit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    
    // Only process edits in the contacts sheet
    if (sheet.getName() !== CONFIG.SHEET_NAME) {
      return;
    }
    
    const row = range.getRow();
    
    // Ignore header row (row 1)
    if (row === 1) {
      return;
    }
    
    // Get the entire row data
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Get headers from first row
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Map row data to contact object
    const contact = {};
    headers.forEach((header, index) => {
      contact[header.toLowerCase().trim()] = rowData[index];
    });
    
    // Validate required fields
    if (!contact.first_name || !contact.last_name || !contact.phone || !contact.birthday) {
      Logger.log('⚠️ Skipping incomplete row: ' + row);
      return;
    }
    
    // Format birthday to YYYY-MM-DD
    // Handle both Date objects (from Sheets auto-detect) and Strings (DD/MM/YYYY)
    if (contact.birthday instanceof Date) {
      const year = contact.birthday.getFullYear();
      const month = String(contact.birthday.getMonth() + 1).padStart(2, '0');
      const day = String(contact.birthday.getDate()).padStart(2, '0');
      contact.birthday = `${year}-${month}-${day}`;
    } else if (typeof contact.birthday === 'string') {
      // Handle "DD/MM/YYYY" string format
      const parts = contact.birthday.split('/');
      if (parts.length === 3) {
        // Assume DD/MM/YYYY
        contact.birthday = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    
    // Send to Supabase
    sendToSupabase(contact, row);
    
  } catch (error) {
    Logger.log('❌ Error in handleEdit: ' + error.toString());
  }
}

/**
 * Sends contact data to Supabase Edge Function
 */
function sendToSupabase(contact, row) {
  try {
    const payload = {
      contact: contact,
      source: 'google_sheets_webhook',
      row: row
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + CONFIG.SERVICE_ROLE_KEY
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true  // Don't throw on HTTP errors
    };
    
    Logger.log('📤 Sending contact: ' + contact.first_name + ' ' + contact.last_name);
    
    const response = UrlFetchApp.fetch(CONFIG.SUPABASE_FUNCTION_URL, options);
    const statusCode = response.getResponseCode();
    
    // Get the sheet to update status
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    
    if (statusCode === 200) {
      Logger.log('✅ Successfully synced row ' + row);
      // Update Status Column (G) and Timestamp (H)
      sheet.getRange(row, 7).setValue('✅ Synced').setFontColor('green');
      sheet.getRange(row, 8).setValue(new Date()).setFontColor('grey');
    } else {
      const errorMsg = '❌ Failed: ' + response.getContentText();
      Logger.log(errorMsg);
      // Update Status Column (G) with Error
      sheet.getRange(row, 7).setValue(errorMsg).setFontColor('red');
      sheet.getRange(row, 8).setValue(new Date()).setFontColor('grey');
    }

/**
 * Manual test function - Run this to test without editing the sheet
 */
function testWebhook() {
  const testContact = {
    first_name: 'Test',
    last_name: 'User',
    email: 'test@example.com',
    phone: '+2348012345678',
    birthday: '1990-01-15',
    notes: 'Test from Apps Script'
  };
  
  sendToSupabase(testContact, 999);
  Logger.log('✅ Test complete. Check Logs (View → Logs) for results');
}

/**
 * ONE-TIME SETUP: Run this function to secure your sheet!
 * It adds:
 * 1. Data Validation (Phone, Date, Email)
 * 2. Header Protection (Locks Row 1)
 * 3. Formatting (Colors, Text Weight)
 * 4. Adds Status Columns (G and H)
 */
function setupSheetProtection() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    Logger.log('❌ Could not find sheet: ' + CONFIG.SHEET_NAME);
    return;
  }

  // 1. Setup Headers (Row 1)
  // Added 'sync_status' and 'last_synced'
  const headers = ['first_name', 'last_name', 'email', 'phone', 'birthday', 'notes', 'sync_status', 'last_synced'];
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#d9d9d9'); // Light grey
  
  // Protect Headers
  const protection = headerRange.protect().setDescription('Header Protection');
  protection.addEditor(Session.getEffectiveUser()); // Only you can edit
  if (protection.canDomainEdit()) {
    protection.setDomainEdit(false);
  }

  // 2. Data Validation
  const maxRows = 1000;
  
  // Phone Column (D) - Nigerian Format
  // Matches: 080..., 090..., 070..., 081... (11 digits)
  // We use a custom formula because there is no direct regex method in Apps Script builder
  const phoneRule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=REGEXMATCH(TO_TEXT(D2), "^0[789][01]\\d{8}$")')
    .setAllowInvalid(false)
    .setHelpText('Enter valid Nigerian phone (e.g., 08012345678)')
    .build();
  sheet.getRange(2, 4, maxRows, 1).setDataValidation(phoneRule);

  // Birthday Column (E) - Valid Date
  const dateRule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .setHelpText('Enter a valid date (DD/MM/YYYY)')
    .build();
  sheet.getRange(2, 5, maxRows, 1).setDataValidation(dateRule);

  // Email Column (C) - Valid Email
  const emailRule = SpreadsheetApp.newDataValidation()
    .requireTextIsEmail()
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 3, maxRows, 1).setDataValidation(emailRule);
  
  // 3. Status Columns (G & H) - Grey Background to indicate "Read Only"
  const statusRange = sheet.getRange(2, 7, maxRows, 2);
  statusRange.setBackground('#f3f3f3'); // Very light grey
  statusRange.setFontColor('#666666'); // Dark grey text

  Logger.log('✅ Sheet Secured: Headers locked & Validation rules applied!');
}
