import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  Mail,
  Phone,
  Cake,
  Tag,
  FileText,
  MessageSquare,
  Loader2,
  Send,
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  birthday: string
  notes?: string
  tags: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

interface MessageLog {
  id: string
  contact_id: string
  template_id: string
  message_type: string
  recipient: string
  content: string
  status: string
  provider_response: any
  sent_at: string | null
  created_at: string
}

interface Template {
  id: string
  name: string
  type: string
  content: string
  subject?: string
}

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [contact, setContact] = useState<Contact | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // SMS functionality
  const [isSendingSMS, setIsSendingSMS] = useState(false)
  const [smsTemplates, setSmsTemplates] = useState<Template[]>([])
  const [showSMSDialog, setShowSMSDialog] = useState(false)
  const [selectedSMSTemplate, setSelectedSMSTemplate] = useState("")

  // EMAIL functionality
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailTemplates, setEmailTemplates] = useState<Template[]>([])
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState("")

  const [recentMessages, setRecentMessages] = useState<MessageLog[]>([])

  // Edit form state
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    birthday: "",
    notes: "",
  })

  // Calculate age from birthday
  const calculateAge = (birthday: string) => {
    const birthDate = new Date(birthday)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  // Calculate days until next birthday
  const daysUntilBirthday = (birthday: string) => {
    const today = new Date()
    const birthDate = new Date(birthday)
    const nextBirthday = new Date(
      today.getFullYear(),
      birthDate.getMonth(),
      birthDate.getDate()
    )

    if (nextBirthday < today) {
      nextBirthday.setFullYear(today.getFullYear() + 1)
    }

    const diffTime = nextBirthday.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return diffDays
  }

  // Fetch contact details
  useEffect(() => {
    fetchContact()
    fetchTemplates()
  }, [id])

  // Fetch message logs
  useEffect(() => {
    if (contact) {
      fetchMessageLogs()
    }
  }, [contact, isSendingSMS, isSendingEmail])

  const fetchContact = async () => {
    if (!id) return

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", id)
        .single()

      if (error) throw error

      setContact(data)
      setEditForm({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email || "",
        phone: data.phone,
        birthday: data.birthday,
        notes: data.notes || "",
      })
    } catch (error) {
      console.error("Error fetching contact:", error)
      toast.error("Failed to Load Contact", {
        description: "Could not fetch contact details",
      })
      navigate("/contacts")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      // Fetch SMS templates
      const { data: smsData, error: smsError } = await supabase
        .from("message_templates")
        .select("*")
        .eq("type", "sms")
        .eq("is_active", true)
        .order("name")

      if (smsError) throw smsError
      setSmsTemplates(smsData || [])

      // Fetch Email templates
      const { data: emailData, error: emailError } = await supabase
        .from("message_templates")
        .select("*")
        .eq("type", "email")
        .eq("is_active", true)
        .order("name")

      if (emailError) throw emailError
      setEmailTemplates(emailData || [])
    } catch (error) {
      console.error("Error fetching templates:", error)
    }
  }

  const fetchMessageLogs = async () => {
    if (!contact) return

    try {
      const { data, error } = await supabase
        .from("message_logs")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(5)

      if (error) throw error
      setRecentMessages(data || [])
    } catch (error) {
      console.error("Error fetching message logs:", error)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    if (contact) {
      setEditForm({
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email || "",
        phone: contact.phone,
        birthday: contact.birthday,
        notes: contact.notes || "",
      })
    }
  }

  const handleSaveEdit = async () => {
    if (!contact) return

    try {
      const { error } = await supabase
        .from("contacts")
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email || null,
          phone: editForm.phone,
          birthday: editForm.birthday,
          notes: editForm.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", contact.id)

      if (error) throw error

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: profile?.id,
        action_type: "update",
        action_description: `Updated contact: ${editForm.first_name} ${editForm.last_name}`,
        entity_type: "contact",
        entity_id: contact.id,
      })

      toast.success("Contact Updated", {
        description: "Contact details have been updated successfully",
      })

      setIsEditing(false)
      fetchContact()
    } catch (error) {
      console.error("Error updating contact:", error)
      toast.error("Update Failed", {
        description: "Could not update contact details",
      })
    }
  }

  const handleDelete = async () => {
    if (!contact) return

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contact.id)

      if (error) throw error

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: profile?.id,
        action_type: "delete",
        action_description: `Deleted contact: ${contact.first_name} ${contact.last_name}`,
        entity_type: "contact",
        entity_id: contact.id,
      })

      // 🔔 Create notification for deleted contact
      await supabase.from('notifications').insert({
        user_id: profile?.id,
        title: 'Contact Deleted',
        message: `${contact.first_name} ${contact.last_name} has been removed from your contacts`,
        type: 'info',
        is_read: false,
        metadata: {
          contact_id: contact.id,
          contact_name: `${contact.first_name} ${contact.last_name}`,
          action: 'contact_deleted'
        }
      })

      toast.success("Contact Deleted", {
        description: "Contact has been permanently deleted",
      })

      navigate("/contacts")
    } catch (error) {
      console.error("Error deleting contact:", error)
      toast.error("Delete Failed", {
        description: "Could not delete contact",
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleSendSMS = async () => {
    if (!selectedSMSTemplate || !contact) return

    setIsSendingSMS(true)

    try {
      console.log("🔥 Sending SMS to Termii API...")
      console.log("Contact:", contact.first_name, contact.phone)
      console.log("Template:", selectedSMSTemplate)

      const { data, error } = await supabase.functions.invoke("send-sms-v2", {
        body: {
          contactId: contact.id,
          templateId: selectedSMSTemplate,
          phoneNumber: contact.phone,
          userId: profile?.id,
        },
      })

      console.log("📡 Response from Edge Function:", data)

      if (error) {
        console.error("❌ Supabase Function Error:", error)
        throw error
      }

      if (data?.success) {
        toast.success("SMS Sent Successfully! 🎉", {
          description: `Birthday message sent to ${contact.first_name}`,
          duration: 5000,
        })

        setShowSMSDialog(false)
        setSelectedSMSTemplate("")
        fetchMessageLogs()
      } else {
        console.error("❌ Termii API Error:", data?.error, data?.details)

        toast.error("SMS Failed", {
          description: data?.error || "Unknown error from Termii API",
          duration: 7000,
        })

        if (data?.details) {
          console.log("📋 Full Termii Response:", JSON.stringify(data.details, null, 2))
        }

        fetchMessageLogs()
      }
    } catch (error: any) {
      console.error("💥 Catch Block Error:", error)

      toast.error("Error Sending SMS", {
        description: error.message || "Failed to connect to SMS service",
        duration: 7000,
      })
    } finally {
      setIsSendingSMS(false)
    }
  }

  const handleSendEmail = async () => {
    if (!selectedEmailTemplate || !contact) return

    if (!contact.email) {
      toast.error("No Email Address", {
        description: "This contact doesn't have an email address",
      })
      return
    }

    setIsSendingEmail(true)

    try {
      console.log("📧 Sending Email via Resend...")
      console.log("Contact:", contact.first_name, contact.email)
      console.log("Template:", selectedEmailTemplate)

      const { data, error } = await supabase.functions.invoke("send-email-v2", {
        body: {
          contactId: contact.id,
          templateId: selectedEmailTemplate,
          userId: profile?.id,
        },
      })

      console.log("📡 Response from Edge Function:", data)

      if (error) {
        console.error("❌ Supabase Function Error:", error)
        throw error
      }

      if (data?.success) {
        toast.success("Email Sent Successfully! 🎉", {
          description: `Birthday email sent to ${contact.first_name}`,
          duration: 5000,
        })

        setShowEmailDialog(false)
        setSelectedEmailTemplate("")
        fetchMessageLogs()
      } else {
        console.error("❌ Resend API Error:", data?.error, data?.details)

        toast.error("Email Failed", {
          description: data?.error || "Unknown error from Resend API",
          duration: 7000,
        })

        if (data?.details) {
          console.log("📋 Full Resend Response:", JSON.stringify(data.details, null, 2))
        }

        fetchMessageLogs()
      }
    } catch (error: any) {
      console.error("💥 Catch Block Error:", error)

      toast.error("Error Sending Email", {
        description: error.message || "Failed to connect to email service",
        duration: 7000,
      })
    } finally {
      setIsSendingEmail(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Contact not found</p>
        <Button onClick={() => navigate("/contacts")} className="mt-4">
          Back to Contacts
        </Button>
      </div>
    )
  }

  const age = calculateAge(contact.birthday)
  const daysUntil = daysUntilBirthday(contact.birthday)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/contacts")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {contact.first_name} {contact.last_name}
            </h1>
            <p className="text-gray-600 mt-1">Contact Details</p>
          </div>
        </div>

        <div className="flex gap-2">
          {!isEditing ? (
            <>
              <Button
                onClick={() => setShowEmailDialog(true)}
                disabled={!contact.email}
                className="bg-blue-600 hover:bg-blue-700"
                title={!contact.email ? "No email address" : ""}
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Birthday Email
              </Button>
              <Button
                onClick={() => setShowSMSDialog(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Send Birthday SMS
              </Button>
              <Button onClick={handleEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </>
          )}
        </div>
      </div>

      {/* Birthday Alert */}
      {daysUntil === 0 ? (
        <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-6 rounded-lg">
          <div className="flex items-center gap-3">
            <Cake className="w-8 h-8" />
            <div>
              <h3 className="text-xl font-bold">🎉 Birthday Today!</h3>
              <p>
                {contact.first_name} is turning {age + 1} today!
              </p>
            </div>
          </div>
        </div>
      ) : daysUntil <= 7 ? (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5" />
            <p>
              <strong>Birthday coming up!</strong> {daysUntil} day{daysUntil !== 1 ? "s" : ""}{" "}
              remaining
            </p>
          </div>
        </div>
      ) : null}

      {/* Contact Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <Input
                    value={editForm.first_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, first_name: e.target.value })
                    }
                    placeholder="First Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <Input
                    value={editForm.last_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, last_name: e.target.value })
                    }
                    placeholder="Last Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                    placeholder="Email Address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone *
                  </label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phone: e.target.value })
                    }
                    placeholder="Phone Number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Birthday *
                  </label>
                  <Input
                    type="date"
                    value={editForm.birthday}
                    onChange={(e) =>
                      setEditForm({ ...editForm, birthday: e.target.value })
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium">{contact.phone}</p>
                  </div>
                </div>
                {contact.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{contact.email}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Cake className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Birthday</p>
                    <p className="font-medium">
                      {new Date(contact.birthday).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}{" "}
                      (Age {age})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Next Birthday</p>
                    <p className="font-medium">
                      {daysUntil === 0
                        ? "Today! 🎉"
                        : `In ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <Input
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm({ ...editForm, notes: e.target.value })
                  }
                  placeholder="Additional notes..."
                />
              </div>
            ) : (
              <>
                {contact.notes && (
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm text-gray-600">Notes</p>
                      <p className="font-medium">{contact.notes}</p>
                    </div>
                  </div>
                )}
                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Tag className="w-5 h-5 text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {contact.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="pt-4 border-t">
                  <p className="text-xs text-gray-500">
                    Created: {new Date(contact.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    Updated: {new Date(contact.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Messages */}
      {recentMessages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Recent Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg border ${msg.status === "sent"
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${msg.status === "sent"
                            ? "bg-green-600 text-white"
                            : "bg-red-600 text-white"
                          }`}
                      >
                        {msg.status.toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-200 text-gray-700 uppercase">
                        {msg.message_type}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {msg.sent_at
                        ? formatDistanceToNow(new Date(msg.sent_at), {
                          addSuffix: true,
                        })
                        : formatDistanceToNow(new Date(msg.created_at), {
                          addSuffix: true,
                        })}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 mb-2 bg-white p-2 rounded">
                    {msg.message_type === 'email' ? (
                      <span dangerouslySetInnerHTML={{ __html: msg.content.substring(0, 200) + '...' }} />
                    ) : (
                      msg.content
                    )}
                  </p>

                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">To:</span>
                      <span>{msg.recipient}</span>
                    </div>

                    {msg.provider_response && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium">
                          View API Response
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                          {JSON.stringify(msg.provider_response, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Send EMAIL Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Send Birthday Email
            </DialogTitle>
            <DialogDescription>
              Send a birthday email to {contact.first_name} {contact.last_name} at{" "}
              {contact.email}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Email Template
            </label>
            <select
              value={selectedEmailTemplate}
              onChange={(e) => setSelectedEmailTemplate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Select a template --</option>
              {emailTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>

            {selectedEmailTemplate && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Subject: {emailTemplates.find((t) => t.id === selectedEmailTemplate)?.subject || "Happy Birthday!"}
                </p>
                <p className="text-xs text-gray-600">
                  ✉️ A beautiful HTML birthday card will be sent
                </p>
              </div>
            )}

            {emailTemplates.length === 0 && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  ⚠️ No email templates found. Please create an email template first in the Templates
                  page.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEmailDialog(false)
                setSelectedEmailTemplate("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={!selectedEmailTemplate || isSendingEmail}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send SMS Dialog */}
      <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              Send Birthday SMS
            </DialogTitle>
            <DialogDescription>
              Send a birthday SMS to {contact.first_name} {contact.last_name} at{" "}
              {contact.phone}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select SMS Template
            </label>
            <select
              value={selectedSMSTemplate}
              onChange={(e) => setSelectedSMSTemplate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Select a template --</option>
              {smsTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>

            {selectedSMSTemplate && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                <p className="text-sm text-gray-600">
                  {smsTemplates
                    .find((t) => t.id === selectedSMSTemplate)
                    ?.content.replace(/\[FirstName\]/g, contact.first_name)
                    .replace(/\[LastName\]/g, contact.last_name)
                    .replace(/\[Name\]/g, `${contact.first_name} ${contact.last_name}`)
                    .replace(/\[Age\]/g, (age + 1).toString())}
                </p>
              </div>
            )}

            {smsTemplates.length === 0 && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  ⚠️ No SMS templates found. Please create an SMS template first in the Templates
                  page.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSMSDialog(false)
                setSelectedSMSTemplate("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendSMS}
              disabled={!selectedSMSTemplate || isSendingSMS}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSendingSMS ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send SMS
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {contact.first_name} {contact.last_name}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Contact
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}