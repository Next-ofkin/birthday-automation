import ComingSoon from "./ComingSoon"

export default function Templates() {
  return (
    <ComingSoon
      title="Message Templates"
      icon="📝"
      description="Create and manage SMS & Email templates"
      features={[
        "Create custom birthday message templates",
        "Use placeholders like {first_name}, {last_name}",
        "Set default templates for SMS and Email",
        "Preview templates before sending",
        "Manage active/inactive templates",
        "Track template usage statistics"
      ]}
    />
  )
}