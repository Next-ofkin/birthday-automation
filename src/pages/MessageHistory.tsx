import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Send,
  Search,
  Filter,
  Download,
  MessageSquare,
  Mail,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  contacts: {
    first_name: string
    last_name: string
  }
  message_templates: {
    name: string
  }
}

export default function MessageHistory() {
  const [messages, setMessages] = useState<MessageLog[]>([])
  const [filteredMessages, setFilteredMessages] = useState<MessageLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [selectedMessage, setSelectedMessage] = useState<MessageLog | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)

  useEffect(() => {
    fetchMessages()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [messages, searchTerm, statusFilter, typeFilter, dateFilter])

  const fetchMessages = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from("message_logs")
        .select(
          `
          *,
          contacts (first_name, last_name),
          message_templates (name)
        `
        )
        .order("created_at", { ascending: false })

      if (error) throw error

      setMessages(data || [])
    } catch (error) {
      console.error("Error fetching messages:", error)
      toast.error("Failed to Load Messages", {
        description: "Could not fetch message history",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...messages]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (msg) =>
          msg.contacts?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          msg.contacts?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          msg.recipient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          msg.content?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((msg) => msg.status === statusFilter)
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((msg) => msg.message_type === typeFilter)
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date()
      let startDate: Date

      switch (dateFilter) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0))
          break
        case "week":
          startDate = new Date(now.setDate(now.getDate() - 7))
          break
        case "month":
          startDate = new Date(now.setMonth(now.getMonth() - 1))
          break
        case "year":
          startDate = new Date(now.setFullYear(now.getFullYear() - 1))
          break
        default:
          startDate = new Date(0)
      }

      filtered = filtered.filter((msg) => new Date(msg.created_at) >= startDate)
    }

    setFilteredMessages(filtered)
    setCurrentPage(1)
  }

  const handleExportCSV = () => {
    if (filteredMessages.length === 0) {
      toast.error("No Data to Export")
      return
    }

    const csvData = filteredMessages.map((msg) => ({
      Date: new Date(msg.created_at).toLocaleString(),
      Contact: `${msg.contacts?.first_name || ""} ${msg.contacts?.last_name || ""}`,
      Recipient: msg.recipient,
      Type: msg.message_type.toUpperCase(),
      Status: msg.status.toUpperCase(),
      Template: msg.message_templates?.name || "N/A",
      Content: msg.content.substring(0, 100),
    }))

    const headers = Object.keys(csvData[0]).join(",")
    const rows = csvData.map((row) => Object.values(row).join(","))
    const csv = [headers, ...rows].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `message-history-${new Date().toISOString().split("T")[0]}.csv`
    a.click()

    toast.success("Export Successful", {
      description: "Message history exported to CSV",
    })
  }

  const handleViewDetails = (message: MessageLog) => {
    setSelectedMessage(message)
    setShowDetailsDialog(true)
  }

  // Pagination
  const totalPages = Math.ceil(filteredMessages.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentMessages = filteredMessages.slice(startIndex, endIndex)

  // Stats
  const totalMessages = filteredMessages.length
  const sentCount = filteredMessages.filter((m) => m.status === "sent").length
  const failedCount = filteredMessages.filter((m) => m.status === "failed").length
  const smsCount = filteredMessages.filter((m) => m.message_type === "sms").length
  const emailCount = filteredMessages.filter((m) => m.message_type === "email").length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Message History</h1>
          <p className="text-gray-600 mt-1">View all sent messages across the system</p>
        </div>
        <Button onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Messages
            </CardTitle>
            <Send className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {totalMessages.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Successfully Sent
            </CardTitle>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {sentCount.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Failed</CardTitle>
            <XCircle className="w-5 h-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {failedCount.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">SMS / Email</CardTitle>
            <MessageSquare className="w-5 h-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {smsCount} / {emailCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name, phone, email, or content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Filter */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Messages Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Messages ({filteredMessages.length})</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => {
                setItemsPerPage(Number(value))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentMessages.length === 0 ? (
            <div className="text-center py-12">
              <Send className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No messages found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentMessages.map((message) => (
                      <TableRow key={message.id}>
                        <TableCell className="text-sm">
                          {formatDistanceToNow(new Date(message.created_at), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {message.contacts?.first_name} {message.contacts?.last_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{message.recipient}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {message.message_type === "sms" ? (
                              <MessageSquare className="w-4 h-4 text-green-600" />
                            ) : (
                              <Mail className="w-4 h-4 text-blue-600" />
                            )}
                            <span className="text-sm font-medium uppercase">
                              {message.message_type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {message.message_templates?.name || "N/A"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              message.status === "sent"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {message.status.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewDetails(message)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredMessages.length)} of{" "}
                  {filteredMessages.length} messages
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Message Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedMessage?.message_type === "sms" ? (
                <MessageSquare className="w-5 h-5 text-green-600" />
              ) : (
                <Mail className="w-5 h-5 text-blue-600" />
              )}
              Message Details
            </DialogTitle>
            <DialogDescription>
              {selectedMessage?.message_type.toUpperCase()} message to{" "}
              {selectedMessage?.contacts?.first_name} {selectedMessage?.contacts?.last_name}
            </DialogDescription>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <div className="mt-1">
                  <span
                    className={`px-3 py-1 text-sm font-semibold rounded-full ${
                      selectedMessage.status === "sent"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {selectedMessage.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Recipient */}
              <div>
                <label className="text-sm font-medium text-gray-700">Recipient</label>
                <p className="mt-1 text-sm text-gray-900">{selectedMessage.recipient}</p>
              </div>

              {/* Template */}
              <div>
                <label className="text-sm font-medium text-gray-700">Template Used</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedMessage.message_templates?.name || "N/A"}
                </p>
              </div>

              {/* Date */}
              <div>
                <label className="text-sm font-medium text-gray-700">Sent At</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedMessage.sent_at
                    ? new Date(selectedMessage.sent_at).toLocaleString()
                    : "Not sent"}
                </p>
              </div>

              {/* Content */}
              <div>
                <label className="text-sm font-medium text-gray-700">Message Content</label>
                <div className="mt-1 p-4 bg-gray-50 rounded-lg text-sm text-gray-900 max-h-40 overflow-y-auto">
                  {selectedMessage.message_type === "email" ? (
                    <div dangerouslySetInnerHTML={{ __html: selectedMessage.content }} />
                  ) : (
                    <p className="whitespace-pre-wrap">{selectedMessage.content}</p>
                  )}
                </div>
              </div>

              {/* Provider Response */}
              {selectedMessage.provider_response && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Provider Response
                  </label>
                  <div className="mt-1 p-4 bg-gray-900 text-gray-100 rounded-lg text-xs font-mono overflow-x-auto max-h-60">
                    <pre>{JSON.stringify(selectedMessage.provider_response, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}