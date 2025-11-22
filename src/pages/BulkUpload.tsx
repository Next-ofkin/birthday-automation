import ComingSoon from "./ComingSoon"

export default function BulkUpload() {
  return (
    <ComingSoon
      title="Bulk Upload"
      icon="📤"
      description="Upload multiple contacts at once"
      features={[
        "Upload CSV or Excel files",
        "Validate data before importing",
        "Detect and prevent duplicates",
        "Preview contacts before saving",
        "See upload history and results",
        "Download sample template file"
      ]}
    />
  )
}