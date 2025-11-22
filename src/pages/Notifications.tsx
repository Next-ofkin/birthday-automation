import ComingSoon from "./ComingSoon"

export default function Notifications() {
  return (
    <ComingSoon
      title="Notifications"
      icon="🔔"
      description="View all system notifications and alerts"
      features={[
        "Failed message alerts",
        "System error notifications",
        "New user signup alerts (for admins)",
        "Low SMS credit warnings",
        "Birthday cron job status",
        "Mark notifications as read/unread"
      ]}
    />
  )
}