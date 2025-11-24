import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { 
  Users, 
  Calendar, 
  MessageSquare, 
  Plus,
  Mail,
  Cake,
  Gift,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Send,
  Settings as SettingsIcon
} from "lucide-react"

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string
  birthday: string
  is_active: boolean
}

interface ActivityLog {
  id: string
  action_type: string
  action_description: string
  entity_type: string | null
  created_at: string
  profiles?: {
    full_name: string | null
    email: string
  }
}

interface DashboardStats {
  totalContacts: number
  activeContacts: number
  todayBirthdays: number
  upcomingBirthdays: number
  totalTemplates: number
  activeTemplates: number
  totalMessages: number
  successfulMessages: number
  failedMessages: number
}

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 0,
    activeContacts: 0,
    todayBirthdays: 0,
    upcomingBirthdays: 0,
    totalTemplates: 0,
    activeTemplates: 0,
    totalMessages: 0,
    successfulMessages: 0,
    failedMessages: 0
  })
  const [todayBirthdays, setTodayBirthdays] = useState<Contact[]>([])
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<Contact[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      // Fetch all contacts
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')

      if (contactsError) throw contactsError

      // Fetch templates
      const { data: templates, error: templatesError } = await supabase
        .from('message_templates')
        .select('*')

      if (templatesError) throw templatesError

      // Fetch sent messages
      const { data: messages, error: messagesError } = await supabase
      .from('message_logs')
        .select('*')

      if (messagesError) throw messagesError

      // Fetch recent activity
      const { data: activities, error: activitiesError } = await supabase
        .from('activity_logs')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      if (activitiesError) throw activitiesError

      // Calculate today's birthdays
      const today = new Date()
      const todayMonth = today.getMonth() + 1
      const todayDay = today.getDate()

      const todayList = (contacts || []).filter(contact => {
        const bday = new Date(contact.birthday)
        return bday.getMonth() + 1 === todayMonth && bday.getDate() === todayDay && contact.is_active
      })

      // Calculate upcoming birthdays (next 7 days)
      const upcomingList = (contacts || []).filter(contact => {
        const bday = new Date(contact.birthday)
        const bdayThisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate())
        
        if (bdayThisYear < today) {
          bdayThisYear.setFullYear(today.getFullYear() + 1)
        }
        
        const daysUntil = Math.ceil((bdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return daysUntil > 0 && daysUntil <= 7 && contact.is_active
      }).sort((a, b) => {
        const aDate = new Date(a.birthday)
        const bDate = new Date(b.birthday)
        const aThisYear = new Date(today.getFullYear(), aDate.getMonth(), aDate.getDate())
        const bThisYear = new Date(today.getFullYear(), bDate.getMonth(), bDate.getDate())
        return aThisYear.getTime() - bThisYear.getTime()
      })

      setTodayBirthdays(todayList)
      setUpcomingBirthdays(upcomingList)
      setRecentActivity(activities || [])

      setStats({
        totalContacts: contacts?.length || 0,
        activeContacts: contacts?.filter(c => c.is_active).length || 0,
        todayBirthdays: todayList.length,
        upcomingBirthdays: upcomingList.length,
        totalTemplates: templates?.length || 0,
        activeTemplates: templates?.filter(t => t.is_active).length || 0,
        totalMessages: messages?.length || 0,
        successfulMessages: messages?.filter(m => m.status === 'sent').length || 0,
        failedMessages: messages?.filter(m => m.status === 'failed').length || 0
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
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
    return `📅 In ${daysUntil} days`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good Morning"
    if (hour < 18) return "Good Afternoon"
    return "Good Evening"
  }

  const getActivityIcon = (actionType: string) => {
    switch (actionType) {
      case 'contact_added':
      case 'contact_updated':
        return <Users className="w-4 h-4" />
      case 'template_created':
      case 'template_updated':
        return <MessageSquare className="w-4 h-4" />
      case 'message_sent':
        return <Send className="w-4 h-4" />
      case 'settings_updated':
        return <SettingsIcon className="w-4 h-4" />
      default:
        return <Activity className="w-4 h-4" />
    }
  }

  const getSuccessRate = () => {
    if (stats.totalMessages === 0) return 0
    return Math.round((stats.successfulMessages / stats.totalMessages) * 100)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {getGreeting()}, {profile?.full_name || 'User'}! 👋
            </h1>
            <p className="text-blue-100 text-lg">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <div className="hidden md:block">
            <div className="text-6xl">🎂</div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/contacts')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Contacts</CardTitle>
            <Users className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.totalContacts}</div>
            <p className="text-xs text-gray-500 mt-1">{stats.activeContacts} active</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Today's Birthdays</CardTitle>
            <Cake className="w-5 h-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.todayBirthdays}</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.todayBirthdays === 0 ? 'No birthdays today' : 'Celebrate! 🎉'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Upcoming (7 days)</CardTitle>
            <Calendar className="w-5 h-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.upcomingBirthdays}</div>
            <p className="text-xs text-gray-500 mt-1">Next week</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/templates')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Templates</CardTitle>
            <MessageSquare className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.totalTemplates}</div>
            <p className="text-xs text-gray-500 mt-1">{stats.activeTemplates} active</p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          {(profile?.role === 'developer' || profile?.role === 'admin' || profile?.role === 'customer_service') && (
            <Card>
              <CardHeader>
                <CardTitle>⚡ Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    className="h-20 flex flex-col gap-2" 
                    variant="outline"
                    onClick={() => navigate('/contacts')}
                  >
                    <Plus className="w-6 h-6" />
                    <span>Add Contact</span>
                  </Button>
                  <Button 
                    className="h-20 flex flex-col gap-2" 
                    variant="outline"
                    onClick={() => navigate('/templates')}
                  >
                    <Mail className="w-6 h-6" />
                    <span>Create Template</span>
                  </Button>
                  <Button 
                    className="h-20 flex flex-col gap-2" 
                    variant="outline"
                    onClick={() => navigate('/bulk-upload')}
                  >
                    <Users className="w-6 h-6" />
                    <span>Bulk Upload</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Today's Birthdays */}
          {todayBirthdays.length > 0 && (
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    🎉 Today's Birthdays ({todayBirthdays.length})
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => navigate('/contacts')}>
                    View All
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {todayBirthdays.map((contact) => (
                    <div 
                      key={contact.id} 
                      className="flex items-center justify-between p-4 bg-white rounded-lg border border-purple-200 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-lg">
                          {contact.first_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {contact.first_name} {contact.last_name}
                          </div>
                          <div className="text-sm text-gray-600">{contact.email || contact.phone}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Gift className="w-5 h-5 text-purple-600" />
                        <span className="text-lg">🎂</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Birthdays */}
          {upcomingBirthdays.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    📅 Upcoming Birthdays ({upcomingBirthdays.length})
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => navigate('/contacts')}>
                    View All
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingBirthdays.slice(0, 5).map((contact) => (
                    <div 
                      key={contact.id} 
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                          {contact.first_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {contact.first_name} {contact.last_name}
                          </div>
                          <div className="text-sm text-gray-600">{formatDate(contact.birthday)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
                        <Clock className="w-4 h-4" />
                        {getDaysUntilBirthday(contact.birthday)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Message Delivery Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">📊 Message Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Success Rate</span>
                  <span className="text-sm font-bold text-green-600">{getSuccessRate()}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${getSuccessRate()}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.successfulMessages}</div>
                    <div className="text-xs text-gray-600">Delivered</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <div>
                    <div className="text-2xl font-bold text-red-600">{stats.failedMessages}</div>
                    <div className="text-xs text-gray-600">Failed</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">📝 Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No recent activity
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.slice(0, 8).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                      <div className="mt-1 text-gray-400">
                        {getActivityIcon(activity.action_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 line-clamp-2">
                          {activity.action_description}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDateTime(activity.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">🟢 System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Database</span>
                <span className="flex items-center gap-2 text-sm font-medium text-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Templates</span>
                <span className="text-sm font-medium text-green-600">
                  {stats.activeTemplates} Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Contacts</span>
                <span className="text-sm font-medium text-green-600">
                  {stats.activeContacts} Active
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Empty States */}
      {todayBirthdays.length === 0 && upcomingBirthdays.length === 0 && stats.totalContacts > 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="text-6xl mb-4">🎂</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Upcoming Birthdays</h3>
              <p className="text-gray-600">
                All clear for the next 7 days! Time to relax. 😊
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {stats.totalContacts === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Contacts Yet</h3>
              <p className="text-gray-600 mb-6">
                Get started by adding your first contact!
              </p>
              <Button onClick={() => navigate('/contacts')}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Contact
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}