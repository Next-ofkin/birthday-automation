import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Calendar, 
  Tag, 
  Edit, 
  Trash2,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string
  birthday: string
  tags: string[]
  notes: string | null
  is_active: boolean
  created_at: string
}

interface SentMessage {
  id: string
  message_type: 'sms' | 'email'
  subject: string | null
  content: string
  status: 'pending' | 'sent' | 'failed' | 'retrying'
  sent_at: string | null
  error_message: string | null
  created_at: string
}

export default function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [contact, setContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<SentMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalMessages: 0,
    sentMessages: 0,
    failedMessages: 0,
    successRate: 0
  })

  // Edit Modal State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birthday: '',
    tags: '',
    notes: '',
    is_active: true
  })

  const canEdit = ['developer', 'admin', 'customer_service'].includes(profile?.role || '')

  useEffect(() => {
    if (id) {
      fetchContact()
      fetchMessages()
    }
  }, [id])

  const fetchContact = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setContact(data)
    } catch (error) {
      console.error('Error fetching contact:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('sent_messages')
        .select('*')
        .eq('contact_id', id)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setMessages(data || [])
      calculateStats(data || [])
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const calculateStats = (messageList: SentMessage[]) => {
    const total = messageList.length
    const sent = messageList.filter(m => m.status === 'sent').length
    const failed = messageList.filter(m => m.status === 'failed').length
    const rate = total > 0 ? Math.round((sent / total) * 100) : 0

    setStats({
      totalMessages: total,
      sentMessages: sent,
      failedMessages: failed,
      successRate: rate
    })
  }

  // Open Edit Dialog and populate form
  const handleEditClick = () => {
    if (contact) {
      setEditForm({
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email || '',
        phone: contact.phone,
        birthday: contact.birthday,
        tags: contact.tags ? contact.tags.join(', ') : '',
        notes: contact.notes || '',
        is_active: contact.is_active
      })
      setIsEditDialogOpen(true)
    }
  }

  // Save edited contact
  const handleSaveEdit = async () => {
    setIsSaving(true)
    try {
      const tagsArray = editForm.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      const { error } = await supabase
        .from('contacts')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email || null,
          phone: editForm.phone,
          birthday: editForm.birthday,
          tags: tagsArray,
          notes: editForm.notes || null,
          is_active: editForm.is_active
        })
        .eq('id', id)

      if (error) throw error

      // Refresh contact data
      await fetchContact()
      setIsEditDialogOpen(false)
      
    } catch (error: any) {
      console.error('Error updating contact:', error)
      alert("Failed to update contact: " + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id)

      if (error) throw error

      navigate('/contacts')
    } catch (error: any) {
      console.error('Error deleting contact:', error)
      alert("Failed to delete contact: " + error.message)
    }
  }

  const getDaysUntilBirthday = () => {
    if (!contact) return 0
    
    const today = new Date()
    const bday = new Date(contact.birthday)
    const bdayThisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate())
    
    if (bdayThisYear < today) {
      bdayThisYear.setFullYear(today.getFullYear() + 1)
    }
    
    return Math.ceil((bdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getAge = () => {
    if (!contact) return 0
    const today = new Date()
    const birthDate = new Date(contact.birthday)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading contact...</p>
        </div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Contact Not Found</h2>
        <Button onClick={() => navigate('/contacts')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Contacts
        </Button>
      </div>
    )
  }

  const daysUntil = getDaysUntilBirthday()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate('/contacts')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Contacts
        </Button>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleEditClick}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete <strong>{contact.first_name} {contact.last_name}</strong>? 
                    This action cannot be undone and will delete all message history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update contact information for {contact.first_name} {contact.last_name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  placeholder="First name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  placeholder="Last name"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+1234567890"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthday">Birthday *</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={editForm.birthday}
                  onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={editForm.tags}
                onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                placeholder="vip, customer, friend"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Any additional notes..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={editForm.is_active}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Active (will receive birthday messages)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-3xl mb-2">
                {contact.first_name} {contact.last_name}
              </CardTitle>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    contact.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {contact.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">Next Birthday</div>
              <div className="text-3xl font-bold text-purple-600">
                {daysUntil === 0 ? '🎉 Today!' : daysUntil === 1 ? '🎂 Tomorrow' : `${daysUntil} days`}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600">Email</div>
                  <div className="font-medium">{contact.email || 'Not provided'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600">Phone</div>
                  <div className="font-medium">{contact.phone}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600">Birthday</div>
                  <div className="font-medium">{formatDate(contact.birthday)} ({getAge()} years old)</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Tag className="w-5 h-5 text-gray-400 mt-1" />
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-2">Tags</div>
                  {contact.tags && contact.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {contact.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">No tags</span>
                  )}
                </div>
              </div>
              {contact.notes && (
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-gray-400 mt-1" />
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 mb-1">Notes</div>
                    <div className="text-sm">{contact.notes}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.totalMessages}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Successfully Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.sentMessages}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.failedMessages}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.successRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Message History */}
      <Card>
        <CardHeader>
          <CardTitle>📨 Message History ({messages.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Messages Yet</h3>
              <p className="text-gray-600">
                No birthday messages have been sent to this contact yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject/Content</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                          message.message_type === 'sms' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {message.message_type === 'sms' ? '📱 SMS' : '✉️ Email'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {message.subject && (
                          <div className="font-medium mb-1">{message.subject}</div>
                        )}
                        <div className="text-sm text-gray-600 line-clamp-2">{message.content}</div>
                      </TableCell>
                      <TableCell>
                        {message.status === 'sent' && (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Sent</span>
                          </div>
                        )}
                        {message.status === 'failed' && (
                          <div className="flex items-center gap-2 text-red-600">
                            <XCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Failed</span>
                          </div>
                        )}
                        {message.status === 'pending' && (
                          <div className="flex items-center gap-2 text-yellow-600">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-medium">Pending</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {message.sent_at ? formatDateTime(message.sent_at) : formatDateTime(message.created_at)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}