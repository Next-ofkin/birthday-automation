# 📘 Birthday-Bot User Guide

Complete guide for using the Birthday Automation System

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Managing Contacts](#managing-contacts)
4. [Sending Messages](#sending-messages)
5. [Bulk Upload](#bulk-upload)
6. [Message Templates](#message-templates)
7. [Analytics & Reports](#analytics--reports)
8. [Message History](#message-history)
9. [Notifications](#notifications)
10. [User Management](#user-management-admin-only)
11. [System Settings](#system-settings-admin-only)
12. [Troubleshooting](#troubleshooting)

---

## 🚀 Getting Started

### Logging In

1. Visit your Birthday-Bot URL (provided by your admin)
2. Enter your email and password
3. Click **"Login"**

**First time users:**
- Your admin will create your account
- You'll receive an email notification
- Contact your admin to get your initial password
- Change your password after first login

### Password Reset

**Forgot your password?**
1. Click **"Forgot Password?"** on login page
2. Enter your email
3. Check your email for reset link
4. Click the link and set a new password

---

## 🏠 Dashboard Overview

The dashboard shows:

### Quick Stats
- **Total Contacts** - Number of people in the system
- **Active Contacts** - Contacts with active status
- **Upcoming Birthdays** - Birthdays in next 7 days
- **Messages Sent This Month** - Total SMS + Email sent

### Upcoming Birthdays
- List of people with birthdays in the next 7 days
- Shows name, birthday date, and days remaining
- Quick action buttons to send messages

### Recent Activity
- Latest actions in the system
- User who performed the action
- Timestamp

### Quick Actions
- **Add New Contact** - Jump to contact creation
- **Bulk Upload** - Import multiple contacts
- **Send Message** - Send birthday message
- **View Analytics** - See detailed reports

---

## 👥 Managing Contacts

### Viewing Contacts

1. Click **"Contacts"** in sidebar
2. See all contacts in a table
3. Use search bar to find specific contacts
4. Filter by status (Active/Inactive)

### Adding a New Contact

1. Click **"Contacts"** → **"Add Contact"**
2. Fill in the form:
   - **First Name*** (required)
   - **Last Name*** (required)
   - **Phone*** (required) - Format: +234XXXXXXXXXX
   - **Email** (optional)
   - **Birthday*** (required) - Select date
   - **Notes** (optional)
   - **Tags** (optional)
3. Click **"Add Contact"**

**Tips:**
- Phone must start with country code (+234 for Nigeria)
- Email is optional but needed for email greetings
- Tags help organize contacts (e.g., "Staff", "VIP")

### Editing a Contact

1. Go to **Contacts**
2. Click on a contact name
3. Click **"Edit"** button
4. Update information
5. Click **"Save Changes"**

### Deleting a Contact

1. Go to contact details
2. Click **"Delete"** button
3. Confirm deletion
4. ⚠️ **Warning:** This cannot be undone!

### Contact Details Page

Shows:
- Personal information (name, phone, email, birthday)
- Age and days until next birthday
- Recent messages sent to this contact
- Quick send buttons for SMS and Email

---

## 📱 Sending Messages

### Manual SMS Sending

1. Go to contact details page
2. Click **"Send Birthday SMS"**
3. Select an SMS template
4. Preview the message
5. Click **"Send SMS"**
6. Check notification for confirmation

### Manual Email Sending

1. Go to contact details page
2. Click **"Send Birthday Email"**
3. Select an email template
4. See subject preview
5. Click **"Send Email"**
6. Check notification for confirmation

**Note:** Email button is disabled if contact has no email address

### Automatic Sending

The system automatically:
- Checks for birthdays every day at 6:00 AM
- Sends SMS and Email to birthday contacts
- Logs all sent messages
- Notifies admins of results

**No manual action required!** ✨

---

## 📤 Bulk Upload

Import multiple contacts at once from Excel or CSV files.

### Preparing Your File

**Supported formats:**
- CSV (.csv)
- Excel (.xls, .xlsx)

**Required columns:**
- `first_name` or `First Name`
- `last_name` or `Last Name`
- `phone` or `Phone Number`
- `birthday` or `Birthday` or `Date of Birth`

**Optional columns:**
- `email` or `Email Address`
- `notes` or `Notes`

**Sample format:**
```csv
first_name,last_name,phone,email,birthday
John,Doe,+2348012345678,john@example.com,1990-05-15
Jane,Smith,+2348087654321,jane@example.com,1985-12-20
```

### Uploading

**Method 1: Drag & Drop**
1. Click **"Bulk Upload"** in sidebar
2. Drag your file into the upload area
3. Drop to upload

**Method 2: Click to Browse**
1. Click **"Bulk Upload"** in sidebar
2. Click **"choose a file"**
3. Select your file
4. Click **"Open"**

**Method 3: Google Drive URL**
1. Click **"Upload from URL"** tab
2. Paste your Google Drive share link
3. Click **"Fetch from URL"**

### Reviewing & Importing

After upload:
1. **Review the preview** - See all contacts in a table
2. **Check validation** - Color-coded rows:
   - ✅ **Green** - Valid, ready to import
   - 🟡 **Yellow** - Duplicate (exists in database)
   - 🔴 **Red** - Invalid data (fix required)
3. **Handle duplicates**:
   - Check **"Include Duplicates"** to import anyway
   - Or leave unchecked to skip
4. Click **"Import Contacts"**
5. Wait for confirmation

**Features:**
- Automatic duplicate detection
- Phone number format correction
- Date format conversion
- Real-time validation
- Batch processing (100 contacts at a time)

### Download Template

1. Click **"Download CSV Template"**
2. Open in Excel
3. Fill with your data
4. Save and upload

---

## 📝 Message Templates

Templates are pre-written messages with placeholders.

### Viewing Templates

1. Click **"Templates"** in sidebar
2. See all SMS and email templates
3. Filter by type (SMS/Email)
4. Filter by status (Active/Inactive)

### Creating a Template

**Admins and Customer Service only**

1. Click **"Templates"** → **"Create Template"**
2. Fill in:
   - **Template Name** - Descriptive name
   - **Type** - SMS or Email
   - **Subject** (email only)
   - **Content** - Your message

**Available Placeholders:**
- `[FirstName]` - Contact's first name
- `[LastName]` - Contact's last name
- `[Name]` - Full name
- `[Age]` - Contact's age

**Example SMS:**
```
Happy Birthday [FirstName]! 🎉 
Wishing you a fantastic day filled with joy. 
May this year bring you endless blessings!
- NOLT Team
```

**Example Email Subject:**
```
Happy Birthday [FirstName]! 🎂
```

3. Preview your template
4. Set as **Active**
5. Click **"Create Template"**

### Editing a Template

1. Go to **Templates**
2. Click on a template
3. Click **"Edit"**
4. Make changes
5. Click **"Save Changes"**

### Default Templates

**Admins can set default templates** in Settings:
- Default SMS Template - Used by automatic sending
- Default Email Template - Used by automatic sending

---

## 📊 Analytics & Reports

View insights and statistics about your messaging.

### Overview Stats

Dashboard shows:
- **Total Messages** - All time count
- **Success Rate** - Percentage delivered
- **This Month** - Messages sent this month
- **Active Contacts** - Current active count

### Message Type Breakdown

See percentage of:
- SMS messages
- Email messages

### Delivery Status

Track:
- Successfully sent (%)
- Failed (%)

### Monthly Trends

Visual chart showing:
- SMS sent per month
- Emails sent per month
- Year selector (2024, 2025, 2026)

### Template Usage

See which templates are used most:
- Template name
- Type (SMS/Email)
- Usage count

### Exporting Reports

Click **"Export PDF"** to download report (coming soon)

---

## 📜 Message History

Complete log of all sent messages.

### Viewing Message History

**Admin and Developer only**

1. Click **"Message History"** in sidebar
2. See all messages sent by the system

### Filtering Messages

**Filter by:**
- **Search** - Name, phone, email, content
- **Status** - All, Sent, Failed
- **Type** - All, SMS, Email
- **Date** - Today, Last 7 days, Last 30 days, Last year, All time

### Viewing Message Details

1. Click the **eye icon** on any message
2. See full details:
   - Status
   - Recipient
   - Template used
   - Sent date/time
   - Full message content
   - Provider response (technical)

### Exporting Message History

1. Apply filters (optional)
2. Click **"Export CSV"**
3. Download and open in Excel

**Pagination:**
- Choose 20, 50, or 100 messages per page
- Navigate with Previous/Next buttons

---

## 🔔 Notifications

Stay updated with system events.

### Viewing Notifications

1. Click the **bell icon** (🔔) in header
2. See unread count badge
3. View dropdown with last 5 notifications

### Types of Notifications

- 🎂 **Birthday Check Complete** - Daily summary
- ✅ **SMS Sent Successfully** - Message delivered
- ❌ **SMS Failed** - Delivery failed
- ✅ **Email Sent Successfully** - Email delivered
- ❌ **Email Failed** - Delivery failed
- 👤 **New User Signed Up** - Admin notification
- 🗑️ **Contact Deleted** - Contact removed

### Managing Notifications

**Mark as read:**
- Click on a notification to mark as read

**View all:**
1. Click **"View All"** in dropdown
2. See full notifications page

**Clear all:**
1. Go to full notifications page
2. Click **"Clear All"**
3. Confirm

**Delete one:**
1. Hover over notification
2. Click trash icon

---

## 👥 User Management (Admin Only)

**Admins and Developers can manage users**

### Viewing Users

1. Click **"User Management"** in sidebar
2. See all registered users
3. View role, email, status

### User Roles

| Role | Description |
|------|-------------|
| **Developer** | Full system access, can modify everything |
| **Admin** | Manage users, contacts, templates, settings |
| **Customer Service** | Manage contacts, send messages, view reports |
| **User** | View-only access to basic features |

### Changing User Roles

1. Go to **User Management**
2. Find the user
3. Click their name
4. Select new role from dropdown
5. Click **"Update Role"**

### Deactivating Users

1. Go to **User Management**
2. Find the user
3. Click **"Deactivate"**
4. User can no longer log in

---

## ⚙️ System Settings (Admin Only)

Configure system behavior and API integrations.

### Accessing Settings

1. Click **"Settings"** in sidebar
2. View all settings grouped by category

### Messaging Settings

**SMS Settings (Termii):**
- Enable/Disable SMS
- Termii API Key
- Sender ID
- Default SMS Template

**Email Settings (Resend):**
- Enable/Disable Email
- Resend API Key
- From Email Address
- From Name
- Default Email Template

### System Settings

- System Timezone (default: UTC+1 - Lagos)
- System Name
- Company Name

### Updating Settings

1. Click **"Edit"** on any setting
2. Change value
3. Click **"Save"**

**⚠️ Important:**
- Invalid API keys will cause message failures
- Test after changing settings
- Keep API keys secure

---

## 🐛 Troubleshooting

### Common Issues

#### **Can't log in**
- Check email and password
- Use "Forgot Password" to reset
- Contact admin to verify your account is active

#### **Contact won't save**
- Check all required fields are filled (marked with *)
- Phone must include country code (+234...)
- Birthday must be a valid date

#### **SMS not sending**
- Check contact has phone number
- Verify SMS is enabled (Settings)
- Check Termii API key is configured
- Verify Termii account has balance
- Contact admin

#### **Email not sending**
- Check contact has email address
- Verify Email is enabled (Settings)
- Check Resend API key is configured
- Verify sender domain is verified
- Contact admin

#### **Bulk upload fails**
- Check file format (CSV or Excel)
- Verify column names match required format
- Check for invalid phone numbers
- Fix validation errors (red rows)
- Try smaller batch if timeout occurs

#### **No birthday messages sent automatically**
- Contact admin to verify cron job is scheduled
- Check default templates are configured
- Verify SMS/Email are enabled

### Getting Help

1. Check this User Guide
2. Check [Troubleshooting](#-troubleshooting) section in README
3. Contact your IT team or admin
4. Email: support@yourcompany.com

---

## 📞 Contact Support

**For technical issues:**
- Email: it@noltfinance.com
- Phone: +234-XXX-XXX-XXXX

**For account issues:**
- Contact your administrator

---

## 🎓 Tips & Best Practices

### For Best Results:

✅ **Keep contacts updated**
- Regular review and update contact information
- Remove inactive contacts
- Add new staff immediately

✅ **Use templates**
- Create professional templates
- Use placeholders for personalization
- Test templates before setting as default

✅ **Monitor analytics**
- Check success rates weekly
- Identify and fix failures
- Review template performance

✅ **Handle duplicates**
- Review duplicates during bulk upload
- Merge or skip as appropriate
- Keep database clean

✅ **Check notifications**
- Review daily to catch issues
- Act on failure notifications
- Keep notification list clean

---

## 🎉 Conclusion

You're now ready to use Birthday-Bot like a pro!

**Remember:**
- The system sends messages automatically every day
- Keep contact information updated
- Monitor notifications for issues
- Contact support if you need help

**Happy Birthday Wishing! 🎂**

---

**Version:** 1.0  
**Last Updated:** November 24, 2025  
**Maintained by:** NOLT Finance IT Team