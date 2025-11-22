import ComingSoon from "./ComingSoon"

export default function Analytics() {
  return (
    <ComingSoon
      title="Analytics & Reports"
      icon="📊"
      description="View insights and statistics"
      features={[
        "Messages sent this month/year",
        "Success vs failure rates",
        "Most active months for birthdays",
        "Template usage statistics",
        "Contact growth over time",
        "Export reports to PDF"
      ]}
    />
  )
}