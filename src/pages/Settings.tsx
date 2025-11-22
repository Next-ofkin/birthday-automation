import ComingSoon from "./ComingSoon"

export default function Settings() {
  return (
    <ComingSoon
      title="System Settings"
      icon="⚙️"
      description="Configure system preferences and API settings"
      features={[
        "Configure Termii API (SMS provider)",
        "Configure Resend API (Email provider)",
        "Set daily cron job schedule",
        "Manage retry settings for failed messages",
        "User role management",
        "System logs and debugging"
      ]}
    />
  )
}