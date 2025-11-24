import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Search, Plus, Calendar, Mail, Phone, Tag, Pencil, Trash2 } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useNavigate } from "react-router-dom"

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

interface ContactFormData {
    first_name: string
    last_name: string
    email: string
    phone: string
    birthday: string
    tags: string
    notes: string
    is_active: boolean
}

export default function Contacts() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [contacts, setContacts] = useState<Contact[]>([])
    const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingContact, setEditingContact] = useState<Contact | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState<ContactFormData>({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        birthday: "",
        tags: "",
        notes: "",
        is_active: true
    })
    const [formError, setFormError] = useState("")
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        todayBirthdays: 0,
        upcomingBirthdays: 0
    })

    const canEdit = ['developer', 'admin', 'customer_service'].includes(profile?.role || '')

    useEffect(() => {
        fetchContacts()
    }, [])

    useEffect(() => {
        filterContacts()
    }, [searchQuery, contacts])

    const fetchContacts = async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error

            setContacts(data || [])
            calculateStats(data || [])
        } catch (error) {
            console.error('Error fetching contacts:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const calculateStats = (contactList: Contact[]) => {
        const today = new Date()
        const todayMonth = today.getMonth() + 1
        const todayDay = today.getDate()

        const todayBirthdays = contactList.filter(contact => {
            const bday = new Date(contact.birthday)
            return bday.getMonth() + 1 === todayMonth && bday.getDate() === todayDay
        }).length

        const upcoming = contactList.filter(contact => {
            const bday = new Date(contact.birthday)
            const bdayThisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate())
            const daysUntil = Math.ceil((bdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            return daysUntil > 0 && daysUntil <= 7
        }).length

        setStats({
            total: contactList.length,
            active: contactList.filter(c => c.is_active).length,
            todayBirthdays,
            upcomingBirthdays: upcoming
        })
    }

    const filterContacts = () => {
        if (!searchQuery.trim()) {
            setFilteredContacts(contacts)
            return
        }

        const query = searchQuery.toLowerCase()
        const filtered = contacts.filter(contact =>
            contact.first_name.toLowerCase().includes(query) ||
            contact.last_name.toLowerCase().includes(query) ||
            contact.email?.toLowerCase().includes(query) ||
            contact.phone.includes(query)
        )
        setFilteredContacts(filtered)
    }

    const openAddDialog = () => {
        setEditingContact(null)
        setFormData({
            first_name: "",
            last_name: "",
            email: "",
            phone: "",
            birthday: "",
            tags: "",
            notes: "",
            is_active: true
        })
        setFormError("")
        setIsDialogOpen(true)
    }

    const openEditDialog = (contact: Contact) => {
        setEditingContact(contact)
        setFormData({
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email || "",
            phone: contact.phone,
            birthday: contact.birthday,
            tags: contact.tags ? contact.tags.join(", ") : "",
            notes: contact.notes || "",
            is_active: contact.is_active
        })
        setFormError("")
        setIsDialogOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setFormError("")
        setIsSaving(true)

        try {
            // Validate
            if (!formData.first_name || !formData.last_name || !formData.phone || !formData.birthday) {
                setFormError("Please fill in all required fields")
                setIsSaving(false)
                return
            }

            // Parse tags
            const tagsArray = formData.tags
                .split(",")
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0)

            const contactData = {
                first_name: formData.first_name,
                last_name: formData.last_name,
                email: formData.email || null,
                phone: formData.phone,
                birthday: formData.birthday,
                tags: tagsArray,
                notes: formData.notes || null,
                is_active: formData.is_active
            }

            if (editingContact) {
                // Update
                const { error } = await supabase
                    .from('contacts')
                    .update(contactData)
                    .eq('id', editingContact.id)

                if (error) throw error

                // 📝 Log activity
                await supabase.from('activity_logs').insert({
                    user_id: profile?.id,
                    action_type: 'contact_updated',
                    action_description: `Updated contact: ${formData.first_name} ${formData.last_name}`,
                    entity_type: 'contact',
                    entity_id: editingContact.id
                })
            } else {
                // Create
                const { data: newContact, error } = await supabase
                    .from('contacts')
                    .insert([contactData])
                    .select()
                    .single()

                if (error) throw error

                // 📝 Log activity
                if (newContact) {
                    await supabase.from('activity_logs').insert({
                        user_id: profile?.id,
                        action_type: 'contact_created',
                        action_description: `Created new contact: ${formData.first_name} ${formData.last_name}`,
                        entity_type: 'contact',
                        entity_id: newContact.id
                    })

                    // 🔔 Create notification for new contact
                    await supabase.from('notifications').insert({
                        user_id: profile?.id,
                        title: 'New Contact Added',
                        message: `${formData.first_name} ${formData.last_name} has been added to your contacts`,
                        type: 'success',
                        is_read: false,
                        link: `/contacts/${newContact.id}`,
                        metadata: {
                            contact_id: newContact.id,
                            contact_name: `${formData.first_name} ${formData.last_name}`,
                            action: 'contact_created'
                        }
                    })
                }
            }

            // Refresh list
            await fetchContacts()
            setIsDialogOpen(false)
        } catch (error: any) {
            console.error('Error saving contact:', error)
            setFormError(error.message || "Failed to save contact")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (contactId: string, contactName: string) => {
        try {
            const { error } = await supabase
                .from('contacts')
                .delete()
                .eq('id', contactId)

            if (error) throw error

            // 📝 Log activity
            await supabase.from('activity_logs').insert({
                user_id: profile?.id,
                action_type: 'contact_deleted',
                action_description: `Deleted contact: ${contactName}`,
                entity_type: 'contact',
                entity_id: contactId
            })

            // 🔔 Create notification for deleted contact
            await supabase.from('notifications').insert({
                user_id: profile?.id,
                title: 'Contact Deleted',
                message: `${contactName} has been removed from your contacts`,
                type: 'info',
                is_read: false,
                metadata: {
                    contact_id: contactId,
                    contact_name: contactName,
                    action: 'contact_deleted'
                }
            })

            // Refresh list
            await fetchContacts()
        } catch (error: any) {
            console.error('Error deleting contact:', error)
            alert("Failed to delete contact: " + error.message)
        }
    }

    const getDaysUntilBirthday = (birthday: string) => {
        const today = new Date()
        const bday = new Date(birthday)
        const bdayThisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate())

        if (bdayThisYear < today) {
            bdayThisYear.setFullYear(today.getFullYear() + 1)
        }

        const daysUntil = Math.ceil((bdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        if (daysUntil === 0) return "🎉 Today!"
        if (daysUntil === 1) return "🎂 Tomorrow"
        if (daysUntil <= 7) return `📅 In ${daysUntil} days`
        return `${daysUntil} days`
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading contacts...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600">Total Contacts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600">Active</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{stats.active}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600">Today's Birthdays</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-purple-600">{stats.todayBirthdays}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600">Upcoming (7 days)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-orange-600">{stats.upcomingBirthdays}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Contact List */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <CardTitle>📇 All Contacts ({filteredContacts.length})</CardTitle>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search contacts..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            {canEdit && (
                                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button onClick={openAddDialog}>
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Contact
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle>
                                                {editingContact ? "Edit Contact" : "Add New Contact"}
                                            </DialogTitle>
                                            <DialogDescription>
                                                {editingContact
                                                    ? "Update contact information below"
                                                    : "Fill in the contact details below"}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <form onSubmit={handleSubmit}>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="first_name">First Name *</Label>
                                                        <Input
                                                            id="first_name"
                                                            value={formData.first_name}
                                                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="last_name">Last Name *</Label>
                                                        <Input
                                                            id="last_name"
                                                            value={formData.last_name}
                                                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="email">Email</Label>
                                                    <Input
                                                        id="email"
                                                        type="email"
                                                        value={formData.email}
                                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                        placeholder="john@example.com"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="phone">Phone *</Label>
                                                        <Input
                                                            id="phone"
                                                            value={formData.phone}
                                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                            placeholder="+1234567890"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="birthday">Birthday *</Label>
                                                        <Input
                                                            id="birthday"
                                                            type="date"
                                                            value={formData.birthday}
                                                            onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                                                    <Input
                                                        id="tags"
                                                        value={formData.tags}
                                                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                                        placeholder="vip, customer, friend"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="notes">Notes</Label>
                                                    <Input
                                                        id="notes"
                                                        value={formData.notes}
                                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                        placeholder="Any additional notes..."
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id="is_active"
                                                        checked={formData.is_active}
                                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                                        className="w-4 h-4 rounded border-gray-300"
                                                    />
                                                    <Label htmlFor="is_active" className="cursor-pointer">
                                                        Active (will receive birthday messages)
                                                    </Label>
                                                </div>

                                                {formError && (
                                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                                        <p className="text-sm text-red-600">{formError}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <DialogFooter>
                                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                                    Cancel
                                                </Button>
                                                <Button type="submit" disabled={isSaving}>
                                                    {isSaving ? "Saving..." : editingContact ? "Update" : "Create"}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredContacts.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">📭</div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">
                                {searchQuery ? "No contacts found" : "No contacts yet"}
                            </h3>
                            <p className="text-gray-600 mb-4">
                                {searchQuery
                                    ? "Try adjusting your search query"
                                    : "Add your first contact to get started!"}
                            </p>
                            {canEdit && !searchQuery && (
                                <Button onClick={openAddDialog}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add First Contact
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Contact Info</TableHead>
                                        <TableHead>Birthday</TableHead>
                                        <TableHead>Next Birthday</TableHead>
                                        <TableHead>Tags</TableHead>
                                        <TableHead>Status</TableHead>
                                        {canEdit && <TableHead>Actions</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredContacts.map((contact) => (
                                        <TableRow key={contact.id}>
                                            <TableCell>
                                                <button
                                                    onClick={() => navigate(`/contacts/${contact.id}`)}
                                                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors text-left"
                                                >
                                                    {contact.first_name} {contact.last_name}
                                                </button>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    {contact.email && (
                                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                                            <Mail className="w-3 h-3" />
                                                            {contact.email}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <Phone className="w-3 h-3" />
                                                        {contact.phone}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Calendar className="w-3 h-3 text-gray-400" />
                                                    {formatDate(contact.birthday)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm font-medium">
                                                    {getDaysUntilBirthday(contact.birthday)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {contact.tags && contact.tags.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {contact.tags.map((tag, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                                                            >
                                                                <Tag className="w-3 h-3" />
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400">No tags</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span
                                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${contact.is_active
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-gray-100 text-gray-800'
                                                        }`}
                                                >
                                                    {contact.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </TableCell>
                                            {canEdit && (
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openEditDialog(contact)}
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Are you sure you want to delete <strong>{contact.first_name} {contact.last_name}</strong>?
                                                                        This action cannot be undone.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => handleDelete(contact.id, `${contact.first_name} ${contact.last_name}`)}
                                                                        className="bg-red-600 hover:bg-red-700"
                                                                    >
                                                                        Delete
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            )}
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