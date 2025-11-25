# 🎂 Birthday-Bot - Automated Birthday Management System

A comprehensive birthday automation system built for NOLT Finance to manage staff birthdays, send automated SMS and email greetings, and track message delivery.

![Birthday-Bot Dashboard](https://img.shields.io/badge/Status-Production-success)
![React](https://img.shields.io/badge/React-18.3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green)

---

## 🌟 Features

### 🎯 Core Functionality
- **Automated Birthday Detection** - Daily cron job checks for birthdays
- **Multi-Channel Messaging** - Send birthday wishes via SMS (Termii) and Email (Resend)
- **Contact Management** - Add, edit, delete, and organize contacts
- **Bulk Import** - Upload contacts via CSV/Excel with smart duplicate detection
- **Message Templates** - Create and manage SMS and email templates
- **Role-Based Access** - 4 user roles (Developer, Admin, Customer Service, User)

### 📊 Analytics & Reporting
- Real-time message statistics
- Success/failure rate tracking
- Monthly trend analysis
- Template usage insights
- Export reports to CSV

### 🔔 Notifications
- In-app notification system
- Real-time updates
- Email alerts for admins
- New user signup notifications

### 🛡️ Security
- Row Level Security (RLS) policies
- Role-based access control
- Secure authentication via Supabase
- Environment variable protection

---

## 🚀 Tech Stack

### Frontend
- **React 18.3** - UI framework
- **TypeScript 5.5** - Type safety
- **Vite** - Build tool
- **Tailwind CSS v4** - Styling
- **shadcn/ui** - Component library
- **React Router** - Client-side routing

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication
  - Edge Functions
  - Realtime subscriptions
  - Cron jobs (pg_cron)

### Integrations
- **Termii API** - SMS delivery (Nigeria)
- **Resend API** - Email delivery
- **Vercel** - Frontend hosting

---

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- Termii API account
- Resend API account

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/your-username/birthday-automation.git
cd birthday-automation
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Set up Supabase**
- Create a new Supabase project
- Run the database schema (see `/docs/database-schema.sql`)
- Deploy Edge Functions:
```bash
npx supabase functions deploy send-sms
npx supabase functions deploy send-email
npx supabase functions deploy check-birthdays
npx supabase functions deploy notify-new-user
```

5. **Configure API keys in Supabase**

Add to `system_settings` table:
- `termii_api_key` - Your Termii API key
- `termii_sender_id` - Your Termii sender ID
- `resend_api_key` - Your Resend API key
- `from_email` - Sender email (e.g., birthday@yourdomain.com)
- `enable_sms` - Set to 'true'
- `enable_email` - Set to 'true'

6. **Run development server**
```bash
npm run dev
```

Visit `http://localhost:5173`

---

## 🏗️ Project Structure
```
birthday-automation/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── Layout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── ui/          # shadcn/ui components
│   ├── context/         # React Context (Auth)
│   ├── lib/             # Utilities (Supabase client)
│   ├── pages/           # Route pages
│   │   ├── Dashboard.tsx
│   │   ├── Contacts.tsx
│   │   ├── Templates.tsx
│   │   ├── Analytics.tsx
│   │   ├── MessageHistory.tsx
│   │   └── ...
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── supabase/
│   └── functions/       # Edge Functions
│       ├── send-sms/
│       ├── send-email/
│       ├── check-birthdays/
│       └── notify-new-user/
├── public/              # Static assets
├── docs/                # Documentation
└── package.json
```

---

## 🎯 User Roles

| Role | Permissions |
|------|-------------|
| **Developer** | Full access to everything |
| **Admin** | Manage users, contacts, templates, settings |
| **Customer Service** | Manage contacts, view analytics, send messages |
| **User** | View dashboard, view contacts, view notifications |

---

## 📅 Daily Birthday Automation

The system automatically:
1. Runs daily at 6:00 AM UTC+1 (Nigerian time)
2. Checks for contacts with birthdays today
3. Sends SMS messages (if enabled and template configured)
4. Sends email messages (if enabled and template configured)
5. Logs all sent messages
6. Creates summary notification for admins

**To schedule the cron job:**
```sql
SELECT cron.schedule(
  'daily-birthday-check',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/check-birthdays',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## 🔧 Configuration

### SMS Settings (Termii)
1. Sign up at [Termii](https://termii.com)
2. Get API key and Sender ID
3. Add to Supabase `system_settings` table

### Email Settings (Resend)
1. Sign up at [Resend](https://resend.com)
2. Verify your domain
3. Get API key
4. Add to Supabase `system_settings` table

### Default Templates
Configure default template IDs in `system_settings`:
- `default_sms_template_id` - UUID of default SMS template
- `default_email_template_id` - UUID of default email template

---

## 📊 Database Schema

### Core Tables
- `profiles` - User information and roles
- `contacts` - Birthday contacts
- `message_templates` - SMS and email templates
- `message_logs` - Sent message history
- `system_settings` - Configuration
- `notifications` - In-app notifications
- `activity_logs` - User activity audit trail

See full schema in `/docs/database-schema.sql`

---

## 🚀 Deployment

### Frontend (Vercel)
```bash
# Build production
npm run build

# Deploy to Vercel
vercel --prod
```

### Backend (Supabase)
```bash
# Deploy Edge Functions
npx supabase functions deploy --no-verify-jwt
```

---

## 📖 Documentation

- **User Guide** - See [USER_GUIDE.md](./docs/USER_GUIDE.md)
- **Admin Guide** - See [ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md)
- **API Documentation** - See [API_DOCS.md](./docs/API_DOCS.md)

---

## 🐛 Troubleshooting

### SMS not sending
- Check Termii API key is correct
- Verify SMS is enabled in system settings
- Check Termii account balance
- Verify phone numbers are in correct format (+234...)

### Email not sending
- Check Resend API key is correct
- Verify domain is verified in Resend
- Check email is enabled in system settings
- Verify sender email matches verified domain

### Birthday cron not running
- Check pg_cron is enabled in Supabase
- Verify cron schedule is created
- Check Edge Function logs
- Verify default template IDs are set

---

## 🤝 Contributing

This is an internal project for NOLT Finance. For questions or issues, contact the development team.

---

## 📝 License

Proprietary - NOLT Finance Internal Use Only

---

## 👨‍💻 Developer

**Excel** - Lead Developer  
**Company:** NOLT Finance  
**Project Start:** November 21, 2025  
**Deployment:** November 24, 2025

---

## 🎉 Acknowledgments

- Supabase for backend infrastructure
- Termii for SMS delivery
- Resend for email delivery
- shadcn/ui for beautiful components
- Vercel for hosting

---

## 📞 Support

For issues or questions:
1. Check the [User Guide](./docs/USER_GUIDE.md)
2. Check the [Troubleshooting](#-troubleshooting) section
3. Contact the IT team

---

**Built with ❤️ by Excel for NOLT Finance**