import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  BarChart3,
  TrendingUp,
  MessageSquare,
  Mail,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  Download,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

interface Stats {
  totalMessages: number
  smsCount: number
  emailCount: number
  successRate: number
  thisMonth: number
  thisYear: number
  totalContacts: number
  activeContacts: number
}

interface MonthlyData {
  month: string
  sms: number
  email: number
  total: number
}

interface TemplateUsage {
  name: string
  type: string
  count: number
}

export default function Analytics() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [templateUsage, setTemplateUsage] = useState<TemplateUsage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    fetchAnalytics()
  }, [selectedYear])

  const fetchAnalytics = async () => {
    setIsLoading(true)
    try {
      // Fetch overall stats
      const { data: allMessages, error: messagesError } = await supabase
        .from("message_logs")
        .select("*")

      if (messagesError) throw messagesError

      const totalMessages = allMessages?.length || 0
      const smsCount = allMessages?.filter((m) => m.message_type === "sms").length || 0
      const emailCount = allMessages?.filter((m) => m.message_type === "email").length || 0
      const successCount = allMessages?.filter((m) => m.status === "sent").length || 0
      const successRate = totalMessages > 0 ? (successCount / totalMessages) * 100 : 0

      // This month
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const thisMonthCount =
        allMessages?.filter((m) => new Date(m.created_at) >= startOfMonth).length || 0

      // This year
      const startOfYear = new Date(now.getFullYear(), 0, 1)
      const thisYearCount =
        allMessages?.filter((m) => new Date(m.created_at) >= startOfYear).length || 0

      // Contact stats
      const { data: contacts, error: contactsError } = await supabase
        .from("contacts")
        .select("id, is_active")

      if (contactsError) throw contactsError

      const totalContacts = contacts?.length || 0
      const activeContacts = contacts?.filter((c) => c.is_active).length || 0

      setStats({
        totalMessages,
        smsCount,
        emailCount,
        successRate,
        thisMonth: thisMonthCount,
        thisYear: thisYearCount,
        totalContacts,
        activeContacts,
      })

      // Fetch monthly data for selected year
      const monthlyStats: MonthlyData[] = []
      for (let month = 0; month < 12; month++) {
        const startDate = new Date(selectedYear, month, 1)
        const endDate = new Date(selectedYear, month + 1, 0, 23, 59, 59)

        const monthMessages = allMessages?.filter((m) => {
          const msgDate = new Date(m.created_at)
          return msgDate >= startDate && msgDate <= endDate
        })

        const sms = monthMessages?.filter((m) => m.message_type === "sms").length || 0
        const email = monthMessages?.filter((m) => m.message_type === "email").length || 0

        monthlyStats.push({
          month: new Date(selectedYear, month).toLocaleDateString("en-US", { month: "short" }),
          sms,
          email,
          total: sms + email,
        })
      }
      setMonthlyData(monthlyStats)

      // Fetch template usage
      const { data: templates, error: templatesError } = await supabase
        .from("message_templates")
        .select("id, name, type")

      if (templatesError) throw templatesError

      const templateStats = templates?.map((template) => {
        const count =
          allMessages?.filter((m) => m.template_id === template.id).length || 0
        return {
          name: template.name,
          type: template.type,
          count,
        }
      })

      setTemplateUsage(templateStats?.sort((a, b) => b.count - a.count) || [])
    } catch (error) {
      console.error("Error fetching analytics:", error)
      toast.error("Failed to Load Analytics", {
        description: "Could not fetch analytics data",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportReport = () => {
    toast.info("Export Feature", {
      description: "PDF export coming soon!",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const maxMonthlyValue = Math.max(...monthlyData.map((d) => d.total), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-gray-600 mt-1">View insights and statistics</p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {[2024, 2025, 2026].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <Button onClick={handleExportReport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Messages
            </CardTitle>
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats?.totalMessages.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Success Rate
            </CardTitle>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats?.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-gray-500 mt-1">Delivered successfully</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              This Month
            </CardTitle>
            <Calendar className="w-5 h-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats?.thisMonth.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">Messages sent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Contacts
            </CardTitle>
            <Users className="w-5 h-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats?.activeContacts.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              of {stats?.totalContacts.toLocaleString()} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Message Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Message Type Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">SMS Messages</span>
                  </div>
                  <span className="text-sm font-bold">
                    {stats?.smsCount.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${
                        stats?.totalMessages
                          ? (stats.smsCount / stats.totalMessages) * 100
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium">Email Messages</span>
                  </div>
                  <span className="text-sm font-bold">
                    {stats?.emailCount.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${
                        stats?.totalMessages
                          ? (stats.emailCount / stats.totalMessages) * 100
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Delivery Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">Successfully Sent</span>
                  </div>
                  <span className="text-sm font-bold">
                    {stats?.successRate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${stats?.successRate || 0}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium">Failed</span>
                  </div>
                  <span className="text-sm font-bold">
                    {(100 - (stats?.successRate || 0)).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-red-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${100 - (stats?.successRate || 0)}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            Monthly Trends - {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {monthlyData.map((data) => (
              <div key={data.month} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{data.month}</span>
                  <span className="text-sm text-gray-600">
                    {data.total} messages ({data.sms} SMS, {data.email} Email)
                  </span>
                </div>
                <div className="relative w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-green-500 transition-all"
                    style={{
                      width: `${(data.sms / maxMonthlyValue) * 100}%`,
                    }}
                  ></div>
                  <div
                    className="absolute h-full bg-blue-500 transition-all"
                    style={{
                      left: `${(data.sms / maxMonthlyValue) * 100}%`,
                      width: `${(data.email / maxMonthlyValue) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6 mt-6 pt-4 border-t">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-600">SMS</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-sm text-gray-600">Email</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-orange-600" />
            Template Usage Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {templateUsage.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No template usage data yet</p>
          ) : (
            <div className="space-y-3">
              {templateUsage.map((template, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{template.name}</p>
                    <p className="text-sm text-gray-600">
                      Type: <span className="uppercase">{template.type}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{template.count}</p>
                    <p className="text-xs text-gray-500">times used</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Year Summary */}
      <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <CardHeader>
          <CardTitle className="text-white">📊 {selectedYear} Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-blue-100 text-sm mb-1">Total Messages</p>
              <p className="text-3xl font-bold">{stats?.thisYear.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-blue-100 text-sm mb-1">Success Rate</p>
              <p className="text-3xl font-bold">{stats?.successRate.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-blue-100 text-sm mb-1">Active Contacts</p>
              <p className="text-3xl font-bold">{stats?.activeContacts.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}