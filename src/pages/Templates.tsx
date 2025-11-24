import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useAuth } from "@/context/AuthContext"
import { Search, Plus, Mail, MessageSquare, Eye, Pencil, Trash2, Image as ImageIcon } from "lucide-react"

interface Template {
  id: string
  name: string
  type: 'sms' | 'email'
  subject: string | null
  content: string
  image_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface TemplateFormData {
  name: string
  type: 'sms' | 'email'
  subject: string
  content: string
  image_url: string
  is_active: boolean
}

export default function Templates() {
  const { profile } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<'all' | 'sms' | 'email'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    smsCount: 0,
    emailCount: 0
  })

  // Form Dialog State
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [formData, setFormData] = useState<TemplateFormData>({
    name: "",
    type: "sms",
    subject: "",
    content: "",
    image_url: "",
    is_active: true
  })
  const [formError, setFormError] = useState("")

  // Preview Dialog State
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
  const [previewName, setPreviewName] = useState("John Doe")

  const canEdit = ['developer', 'admin', 'customer_service'].includes(profile?.role || '')

  // Pre-built HTML email templates
  const emailTemplateDesigns = [
    {
      name: "Classic Birthday",
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 10px;">
  <div style="background: white; padding: 40px; border-radius: 10px; text-align: center;">
    <h1 style="color: #667eea; font-size: 36px; margin-bottom: 20px;">🎉 Happy Birthday!</h1>
    {{IMAGE}}
    <h2 style="color: #333; font-size: 28px; margin: 30px 0;">Dear [Name],</h2>
    <p style="color: #666; font-size: 18px; line-height: 1.6; margin: 20px 0;">
      Wishing you a day filled with happiness and a year filled with joy! 
      May all your birthday wishes come true! 🎂
    </p>
    <div style="margin: 30px 0;">
      <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; border-radius: 25px; font-size: 18px; font-weight: bold;">
        🎈 Celebrate! 🎈
      </div>
    </div>
    <p style="color: #999; font-size: 14px; margin-top: 40px;">
      Best wishes from our team!
    </p>
  </div>
</div>`
    },
    {
      name: "Modern Minimal",
      html: `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 40px 20px;">
  <div style="background: white; padding: 60px 40px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
    {{IMAGE}}
    <h1 style="color: #2c3e50; font-size: 42px; font-weight: 300; margin: 30px 0 10px; text-align: center;">Happy Birthday</h1>
    <h2 style="color: #3498db; font-size: 32px; font-weight: 600; margin: 0 0 30px; text-align: center;">[Name]</h2>
    <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #3498db, #2ecc71); margin: 0 auto 30px;"></div>
    <p style="color: #555; font-size: 18px; line-height: 1.8; text-align: center; margin: 20px 0;">
      Today is all about you! We hope this special day brings you endless joy, 
      wonderful memories, and all the cake you can eat! 🎂✨
    </p>
    <div style="text-align: center; margin: 40px 0;">
      <span style="font-size: 48px;">🎉 🎈 🎁 🎊</span>
    </div>
    <p style="color: #888; font-size: 14px; text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
      With warmest wishes
    </p>
  </div>
</div>`
    },
    {
      name: "Colorful Celebration",
      html: `<div style="font-family: 'Comic Sans MS', cursive, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(45deg, #ff6b6b, #f06595, #cc5de8, #845ef7); padding: 40px 20px;">
  <div style="background: white; padding: 40px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
    <div style="text-align: center; margin-bottom: 30px;">
      <span style="font-size: 80px; line-height: 1;">🎂</span>
    </div>
    {{IMAGE}}
    <h1 style="color: #ff6b6b; font-size: 48px; text-align: center; margin: 20px 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.1);">
      HAPPY BIRTHDAY!
    </h1>
    <h2 style="color: #845ef7; font-size: 32px; text-align: center; margin: 20px 0;">
      🎉 [Name] 🎉
    </h2>
    <p style="color: #333; font-size: 20px; line-height: 1.6; text-align: center; margin: 30px 0; background: linear-gradient(135deg, #fff5f5 0%, #f8f0fc 100%); padding: 20px; border-radius: 10px;">
      Another year older, another year wiser, and another year more awesome! 
      Have a fantastic birthday filled with love, laughter, and lots of presents! 🎁
    </p>
    <div style="text-align: center; margin: 30px 0; font-size: 40px;">
      🎊 🎈 🎉 🎁 🍰 🎈 🎊
    </div>
    <p style="color: #666; font-size: 16px; text-align: center; font-style: italic;">
      Cheers to another amazing year ahead! 🥳
    </p>
  </div>
</div>`
    }
  ]

  useEffect(() => {
    fetchTemplates()
  }, [])

  useEffect(() => {
    filterTemplates()
  }, [searchQuery, filterType, templates])

  const fetchTemplates = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setTemplates(data || [])
      calculateStats(data || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateStats = (templateList: Template[]) => {
    setStats({
      total: templateList.length,
      active: templateList.filter(t => t.is_active).length,
      smsCount: templateList.filter(t => t.type === 'sms').length,
      emailCount: templateList.filter(t => t.type === 'email').length
    })
  }

  const filterTemplates = () => {
    let filtered = templates

    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.content.toLowerCase().includes(query) ||
        t.subject?.toLowerCase().includes(query)
      )
    }

    setFilteredTemplates(filtered)
  }

  const openAddDialog = () => {
    setEditingTemplate(null)
    setFormData({
      name: "",
      type: "sms",
      subject: "",
      content: "",
      image_url: "",
      is_active: true
    })
    setFormError("")
    setIsFormDialogOpen(true)
  }

  const openEditDialog = (template: Template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      type: template.type,
      subject: template.subject || "",
      content: template.content,
      image_url: template.image_url || "",
      is_active: template.is_active
    })
    setFormError("")
    setIsFormDialogOpen(true)
  }

  const openPreviewDialog = (template: Template) => {
    setPreviewTemplate(template)
    setPreviewName("John Doe")
    setIsPreviewDialogOpen(true)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setFormError("Image must be less than 2MB")
      return
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setFormError("Please upload an image file")
      return
    }

    setIsUploadingImage(true)
    setFormError("")

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('template-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('template-images')
        .getPublicUrl(filePath)

      setFormData({ ...formData, image_url: publicUrl })
    } catch (error: any) {
      console.error('Error uploading image:', error)
      setFormError("Failed to upload image: " + error.message)
    } finally {
      setIsUploadingImage(false)
    }
  }

  const usePrebuiltTemplate = (design: typeof emailTemplateDesigns[0]) => {
    setFormData({
      ...formData,
      content: design.html,
      name: formData.name || design.name
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setIsSaving(true)

    try {
      if (!formData.name || !formData.content) {
        setFormError("Please fill in all required fields")
        setIsSaving(false)
        return
      }

      if (formData.type === 'email' && !formData.subject) {
        setFormError("Email templates require a subject line")
        setIsSaving(false)
        return
      }

      const templateData = {
        name: formData.name,
        type: formData.type,
        subject: formData.type === 'email' ? formData.subject : null,
        content: formData.content,
        image_url: formData.image_url || null,
        is_active: formData.is_active
      }

      if (editingTemplate) {
        const { error } = await supabase
          .from('message_templates')
          .update(templateData)
          .eq('id', editingTemplate.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('message_templates')
          .insert([templateData])

        if (error) throw error
      }

      await fetchTemplates()
      setIsFormDialogOpen(false)
    } catch (error: any) {
      console.error('Error saving template:', error)
      setFormError(error.message || "Failed to save template")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error

      await fetchTemplates()
    } catch (error: any) {
      console.error('Error deleting template:', error)
      alert("Failed to delete template: " + error.message)
    }
  }

  const toggleActive = async (template: Template) => {
    try {
      const { error } = await supabase
        .from('message_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id)

      if (error) throw error

      await fetchTemplates()
    } catch (error: any) {
      console.error('Error toggling template status:', error)
      alert("Failed to update template: " + error.message)
    }
  }

  const replaceVariables = (text: string, name: string, imageUrl?: string) => {
    let result = text
      .replace(/\[Name\]/g, name)
      .replace(/\[FirstName\]/g, name.split(' ')[0])
      .replace(/\[LastName\]/g, name.split(' ')[1] || '')

    // Replace {{IMAGE}} placeholder with actual image
    if (imageUrl) {
      const imageHtml = `<div style="text-align: center; margin: 20px 0;"><img src="${imageUrl}" alt="Birthday" style="max-width: 100%; height: auto; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" /></div>`
      result = result.replace(/\{\{IMAGE\}\}/g, imageHtml)
    } else {
      result = result.replace(/\{\{IMAGE\}\}/g, '')
    }

    return result
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading templates...</p>
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
            <CardTitle className="text-sm font-medium text-gray-600">Total Templates</CardTitle>
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
            <CardTitle className="text-sm font-medium text-gray-600">SMS Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.smsCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Email Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.emailCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Templates List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>📝 Message Templates ({filteredTemplates.length})</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-2">
                <Button
                  variant={filterType === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('all')}
                >
                  All
                </Button>
                <Button
                  variant={filterType === 'sms' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('sms')}
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  SMS
                </Button>
                <Button
                  variant={filterType === 'email' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('email')}
                >
                  <Mail className="w-4 h-4 mr-1" />
                  Email
                </Button>
              </div>

              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {canEdit && (
                <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddDialog}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingTemplate ? "Edit Template" : "Create New Template"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingTemplate
                          ? "Update the template details below"
                          : "Create a professional message template with images"}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Template Name *</Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder="e.g., Birthday Email Template"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="type">Message Type *</Label>
                            <div className="flex gap-4 pt-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="type"
                                  value="sms"
                                  checked={formData.type === 'sms'}
                                  onChange={() => setFormData({ ...formData, type: 'sms' })}
                                  className="w-4 h-4"
                                />
                                <MessageSquare className="w-4 h-4" />
                                <span>SMS</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="type"
                                  value="email"
                                  checked={formData.type === 'email'}
                                  onChange={() => setFormData({ ...formData, type: 'email' })}
                                  className="w-4 h-4"
                                />
                                <Mail className="w-4 h-4" />
                                <span>Email</span>
                              </label>
                            </div>
                          </div>
                        </div>

                        {formData.type === 'email' && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="subject">Email Subject *</Label>
                              <Input
                                id="subject"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                placeholder="e.g., Happy Birthday [Name]! 🎉"
                                required={formData.type === 'email'}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Pre-built Email Designs</Label>
                              <div className="grid grid-cols-3 gap-3">
                                {emailTemplateDesigns.map((design, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => usePrebuiltTemplate(design)}
                                    className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors text-sm font-medium"
                                  >
                                    {design.name}
                                  </button>
                                ))}
                              </div>
                              <p className="text-xs text-gray-500">
                                Click a design to use it as your template base
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="image">Birthday Image (Optional)</Label>
                              <div className="flex gap-3 items-start">
                                <div className="flex-1">
                                  <Input
                                    id="image"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    disabled={isUploadingImage}
                                    className="cursor-pointer"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Upload a birthday image (max 2MB). Use <code className="bg-gray-100 px-1 rounded">{'{{IMAGE}}'}</code> in your HTML to place it.
                                  </p>
                                </div>
                                {isUploadingImage && (
                                  <div className="text-sm text-blue-600">Uploading...</div>
                                )}
                              </div>
                              {formData.image_url && (
                                <div className="mt-2">
                                  <img 
                                    src={formData.image_url} 
                                    alt="Preview" 
                                    className="max-w-xs rounded-lg border"
                                  />
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="content">
                            {formData.type === 'sms' ? 'SMS Message *' : 'HTML Email Content *'}
                          </Label>
                          <textarea
                            id="content"
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            placeholder={formData.type === 'sms' 
                              ? "e.g., Happy Birthday [Name]! 🎂 Wishing you a wonderful day!"
                              : "Paste your HTML email template here or use a pre-built design above"
                            }
                            rows={formData.type === 'email' ? 12 : 6}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                          />
                          <p className="text-sm text-gray-500">
                            💡 Use <code className="bg-gray-100 px-1 rounded">[Name]</code>, 
                            <code className="bg-gray-100 px-1 rounded ml-1">[FirstName]</code>, or 
                            <code className="bg-gray-100 px-1 rounded ml-1">[LastName]</code> for personalization
                            {formData.type === 'email' && (
                              <>, and <code className="bg-gray-100 px-1 rounded ml-1">{'{{IMAGE}}'}</code> for image placement</>
                            )}
                          </p>
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
                            Active (will be used for birthday messages)
                          </Label>
                        </div>

                        {formError && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{formError}</p>
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsFormDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving || isUploadingImage}>
                          {isSaving ? "Saving..." : editingTemplate ? "Update" : "Create"}
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
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {searchQuery || filterType !== 'all' ? "No templates found" : "No templates yet"}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchQuery || filterType !== 'all'
                  ? "Try adjusting your filters or search query"
                  : "Create your first message template to get started!"}
              </p>
              {canEdit && !searchQuery && filterType === 'all' && (
                <Button onClick={openAddDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Template
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    {canEdit && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                          template.type === 'sms' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {template.type === 'sms' ? (
                            <><MessageSquare className="w-3 h-3" /> SMS</>
                          ) : (
                            <><Mail className="w-3 h-3" /> Email</>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{template.name}</div>
                        {template.subject && (
                          <div className="text-xs text-gray-500 mt-1">{template.subject}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600 line-clamp-2 max-w-md">
                          {template.type === 'email' 
                            ? template.content.substring(0, 100).replace(/<[^>]*>/g, '')
                            : template.content.substring(0, 100)
                          }
                          {template.content.length > 100 && '...'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {template.image_url ? (
                          <ImageIcon className="w-5 h-5 text-green-600" />
                        ) : (
                          <span className="text-gray-400 text-sm">No image</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => canEdit && toggleActive(template)}
                          disabled={!canEdit}
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            template.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          } ${canEdit ? 'cursor-pointer hover:opacity-75' : 'cursor-default'}`}
                        >
                          {template.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600">
                          {formatDate(template.updated_at)}
                        </div>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => openPreviewDialog(template)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => openEditDialog(template)}
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
                                  <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete <strong>{template.name}</strong>?
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(template.id)}
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

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>
              See how your message will look with variables replaced
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="preview-name">Preview Name</Label>
                <Input
                  id="preview-name"
                  value={previewName}
                  onChange={(e) => setPreviewName(e.target.value)}
                  placeholder="Enter a name for preview"
                />
              </div>

              <div className="border rounded-lg overflow-hidden">
                {previewTemplate.type === 'email' ? (
                  <div className="bg-gray-100 p-6">
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: replaceVariables(
                          previewTemplate.content, 
                          previewName,
                          previewTemplate.image_url || undefined
                        ) 
                      }}
                    />
                  </div>
                ) : (
                  <div className="p-6 bg-gray-50">
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                        <MessageSquare className="w-3 h-3" /> SMS Message
                      </span>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200 text-gray-900 whitespace-pre-wrap">
                      {replaceVariables(previewTemplate.content, previewName)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsPreviewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}