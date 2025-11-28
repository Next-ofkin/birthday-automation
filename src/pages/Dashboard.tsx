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
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
  Phone
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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
  next3DaysBirthdays: number
  next7DaysBirthdays: number
  totalTemplates: number
  activeTemplates: number
  totalMessages: number
  successfulMessages: number
  failedMessages: number
}

interface PaginationState {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 0,
    activeContacts: 0,
    todayBirthdays: 0,
    next3DaysBirthdays: 0,
    next7DaysBirthdays: 0,
    totalTemplates: 0,
    activeTemplates: 0,
    totalMessages: 0,
    successfulMessages: 0,
    failedMessages: 0
  })
  const [todayBirthdays, setTodayBirthdays] = useState<Contact[]>([])
  const [next3DaysBirthdays, setNext3DaysBirthdays] = useState<Contact[]>([])
  const [next7DaysBirthdays, setNext7DaysBirthdays] = useState<Contact[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Upcoming birthdays modal state
  const [isUpcomingModalOpen, setIsUpcomingModalOpen] = useState(false)
  const [upcomingPagination, setUpcomingPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 12,
    totalCount: 0,
    totalPages: 0
  })
  const [allUpcomingBirthdays, setAllUpcomingBirthdays] = useState<Contact[]>([])
  const [filteredUpcomingBirthdays, setFilteredUpcomingBirthdays] = useState<Contact[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchDashboardData()
  }, [])

  useEffect(() => {
    if (isUpcomingModalOpen) {
      fetchAllUpcomingBirthdays()
    }
  }, [isUpcomingModalOpen])

  useEffect(() => {
    filterUpcomingBirthdays()
  }, [searchQuery, allUpcomingBirthdays])

  // Helper function to calculate days until birthday
  const calculateDaysUntilBirthday = (birthdayString: string): number => {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to start of day
    
    const birthday = new Date(birthdayString)
    const thisYearBirthday = new Date(
      today.getFullYear(),
      birthday.getMonth(),
      birthday.getDate()
    )
    
    // If birthday already passed this year, get next year's date
    if (thisYearBirthday < today) {
      thisYearBirthday.setFullYear(today.getFullYear() + 1)
    }
    
    const diffTime = thisYearBirthday.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays
  }

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      const [
        contactsCount,
        activeContactsCount,
        templatesCount,
        activeTemplatesCount,
        messagesCount,
        successfulMessagesCount,
        failedMessagesCount,
        todayBirthdaysData,
        next3DaysBirthdaysData,
        next7DaysBirthdaysData,
        activitiesData
      ] = await Promise.all([
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('message_templates').select('*', { count: 'exact', head: true }),
        supabase.from('message_templates').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('message_logs').select('*', { count: 'exact', head: true }),
        supabase.from('message_logs').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
        supabase.from('message_logs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        fetchTodaysBirthdays(),
        fetchNext3DaysBirthdays(),
        fetchNext7DaysBirthdays(),
        supabase
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
      ])

      setStats({
        totalContacts: contactsCount.count || 0,
        activeContacts: activeContactsCount.count || 0,
        todayBirthdays: todayBirthdaysData.length,
        next3DaysBirthdays: next3DaysBirthdaysData.length,
        next7DaysBirthdays: next7DaysBirthdaysData.length,
        totalTemplates: templatesCount.count || 0,
        activeTemplates: activeTemplatesCount.count || 0,
        totalMessages: messagesCount.count || 0,
        successfulMessages: successfulMessagesCount.count || 0,
        failedMessages: failedMessagesCount.count || 0
      })

      setTodayBirthdays(todayBirthdaysData)
      setNext3DaysBirthdays(next3DaysBirthdaysData)
      setNext7DaysBirthdays(next7DaysBirthdaysData)
      setRecentActivity(activitiesData.data || [])

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAllUpcomingBirthdays = async () => {
    try {
      const data = await fetchNext7DaysBirthdays(true) // true for all upcoming birthdays
      setAllUpcomingBirthdays(data)
      setUpcomingPagination(prev => ({
        ...prev,
        totalCount: data.length,
        totalPages: Math.ceil(data.length / prev.pageSize)
      }))
    } catch (error) {
      console.error('Error fetching all upcoming birthdays:', error)
    }
  }

  const fetchTodaysBirthdays = async (): Promise<Contact[]> => {
    const today = new Date()
    const todayMonth = today.getMonth() + 1
    const todayDay = today.getDate()
    
    try {
      // Fetch all active contacts and filter in JavaScript
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, birthday, is_active')
        .eq('is_active', true)

      if (error) throw error
      
      // Filter contacts whose birthday month and day match today
      const todayBirthdays = (data || []).filter(contact => {
        const birthday = new Date(contact.birthday)
        return birthday.getMonth() + 1 === todayMonth && birthday.getDate() === todayDay
      })

      return todayBirthdays
    } catch (error) {
      console.error('Error fetching today birthdays:', error)
      return []
    }
  }

  const fetchNext3DaysBirthdays = async (): Promise<Contact[]> => {
    try {
      // Fetch all active contacts
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, birthday, is_active')
        .eq('is_active', true)

      if (error) throw error

      // Filter contacts with birthdays in the next 1-3 days (excluding today)
      const filteredData = (data || []).filter(contact => {
        const daysUntil = calculateDaysUntilBirthday(contact.birthday)
        return daysUntil >= 1 && daysUntil <= 3
      })

      // Sort by days until birthday
      filteredData.sort((a, b) => {
        return calculateDaysUntilBirthday(a.birthday) - calculateDaysUntilBirthday(b.birthday)
      })

      return filteredData
    } catch (error) {
      console.error('Error fetching next 3 days birthdays:', error)
      return []
    }
  }

  const fetchNext7DaysBirthdays = async (getAll: boolean = false): Promise<Contact[]> => {
    try {
      // Fetch all active contacts
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, birthday, is_active')
        .eq('is_active', true)

      if (error) throw error

      // Filter contacts with birthdays in the next 1-7 days (excluding today)
      const filteredData = (data || []).filter(contact => {
        const daysUntil = calculateDaysUntilBirthday(contact.birthday)
        return daysUntil >= 1 && daysUntil <= 7
      })

      // Sort by days until birthday
      filteredData.sort((a, b) => {
        return calculateDaysUntilBirthday(a.birthday) - calculateDaysUntilBirthday(b.birthday)
      })

      // If not getting all, limit to 5 for dashboard preview
      if (!getAll) {
        return filteredData.slice(0, 5)
      }

      return filteredData
    } catch (error) {
      console.error('Error fetching next 7 days birthdays:', error)
      return []
    }
  }

  const filterUpcomingBirthdays = () => {
    if (!searchQuery.trim()) {
      setFilteredUpcomingBirthdays(allUpcomingBirthdays)
      setUpcomingPagination(prev => ({
        ...prev,
        totalCount: allUpcomingBirthdays.length,
        totalPages: Math.ceil(allUpcomingBirthdays.length / prev.pageSize),
        page: 1
      }))
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = allUpcomingBirthdays.filter(contact =>
      contact.first_name.toLowerCase().includes(query) ||
      contact.last_name.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.phone.includes(query)
    )

    setFilteredUpcomingBirthdays(filtered)
    setUpcomingPagination(prev => ({
      ...prev,
      totalCount: filtered.length,
      totalPages: Math.ceil(filtered.length / prev.pageSize),
      page: 1
    }))
  }

  const getCurrentUpcomingPage = () => {
    const startIndex = (upcomingPagination.page - 1) * upcomingPagination.pageSize
    const endIndex = startIndex + upcomingPagination.pageSize
    return filteredUpcomingBirthdays.slice(startIndex, endIndex)
  }

  const goToUpcomingPage = (page: number) => {
    setUpcomingPagination(prev => ({ ...prev, page }))
  }

  const nextUpcomingPage = () => {
    if (upcomingPagination.page < upcomingPagination.totalPages) {
      setUpcomingPagination(prev => ({ ...prev, page: prev.page + 1 }))
    }
  }

  const prevUpcomingPage = () => {
    if (upcomingPagination.page > 1) {
      setUpcomingPagination(prev => ({ ...prev, page: prev.page - 1 }))
    }
  }

  const getDaysUntilBirthday = (birthday: string) => {
    const daysUntil = calculateDaysUntilBirthday(birthday)
    
    if (daysUntil === 0) return "🎉 Today!"
    if (daysUntil === 1) return "🎂 Tomorrow"
    return `📅 In ${daysUntil} days`
  }

  const getBirthdayBadgeColor = (daysUntil: number) => {
    if (daysUntil === 0) return "bg-gradient-to-r from-purple-500 to-pink-600 text-white"
    if (daysUntil === 1) return "bg-gradient-to-r from-orange-500 to-red-500 text-white"
    if (daysUntil <= 3) return "bg-gradient-to-r from-yellow-500 to-orange-500 text-white"
    return "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatShortDate = (dateString: string) => {
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

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  const openUpcomingModal = () => {
    setIsUpcomingModalOpen(true)
    setSearchQuery("")
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
            <div className="text-3xl font-bold text-blue-600">{formatNumber(stats.totalContacts)}</div>
            <p className="text-xs text-gray-500 mt-1">{formatNumber(stats.activeContacts)} active</p>
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
            <CardTitle className="text-sm font-medium text-gray-600">Next 3 Days</CardTitle>
            <Calendar className="w-5 h-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.next3DaysBirthdays}</div>
            <p className="text-xs text-gray-500 mt-1">Upcoming soon</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Next 7 Days</CardTitle>
            <Calendar className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.next7DaysBirthdays}</div>
            <p className="text-xs text-gray-500 mt-1">This week</p>
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
                    View All Contacts
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

          {/* Next 3 Days Birthdays */}
          {next3DaysBirthdays.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    ⏰ Next 3 Days ({next3DaysBirthdays.length})
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={openUpcomingModal}>
                    View All Upcoming
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {next3DaysBirthdays.slice(0, 5).map((contact) => {
                    const daysUntil = getDaysUntilBirthday(contact.birthday)
                    const daysNumber = calculateDaysUntilBirthday(contact.birthday)
                    
                    return (
                      <div 
                        key={contact.id} 
                        className="flex items-center justify-between p-4 bg-white rounded-lg border border-orange-200 hover:shadow-md transition-all cursor-pointer group"
                        onClick={() => navigate(`/contacts/${contact.id}`)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold group-hover:scale-110 transition-transform">
                            {contact.first_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {contact.first_name} {contact.last_name}
                            </div>
                            <div className="text-sm text-gray-600">{formatShortDate(contact.birthday)}</div>
                          </div>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getBirthdayBadgeColor(daysNumber)}`}>
                          <Clock className="w-3 h-3" />
                          {daysUntil}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next 7 Days Birthdays */}
          {next7DaysBirthdays.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    📅 This Week ({stats.next7DaysBirthdays})
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={openUpcomingModal}>
                      View All
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate('/contacts')}>
                      All Contacts
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {next7DaysBirthdays.slice(0, 5).map((contact) => {
                    const daysUntil = getDaysUntilBirthday(contact.birthday)
                    const daysNumber = calculateDaysUntilBirthday(contact.birthday)
                    
                    return (
                      <div 
                        key={contact.id} 
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 hover:shadow-md transition-all cursor-pointer group"
                        onClick={() => navigate(`/contacts/${contact.id}`)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold group-hover:scale-110 transition-transform">
                            {contact.first_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {contact.first_name} {contact.last_name}
                            </div>
                            <div className="text-sm text-gray-600">{formatShortDate(contact.birthday)}</div>
                          </div>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getBirthdayBadgeColor(daysNumber)}`}>
                          <Clock className="w-3 h-3" />
                          {daysUntil}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {stats.next7DaysBirthdays > 5 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={openUpcomingModal}
                    >
                      View {stats.next7DaysBirthdays - 5} more birthdays this week
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}
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
                    <div className="text-2xl font-bold text-green-600">{formatNumber(stats.successfulMessages)}</div>
                    <div className="text-xs text-gray-600">Delivered</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <div>
                    <div className="text-2xl font-bold text-red-600">{formatNumber(stats.failedMessages)}</div>
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
                  {formatNumber(stats.activeContacts)} Active
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upcoming Birthdays Modal */}
      <Dialog open={isUpcomingModalOpen} onOpenChange={setIsUpcomingModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Calendar className="w-6 h-6 text-orange-600" />
                Upcoming Birthdays - Next 7 Days ({filteredUpcomingBirthdays.length})
              </DialogTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsUpcomingModalOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-shrink-0 border-b pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search upcoming birthdays..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {getCurrentUpcomingPage().length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎂</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {searchQuery ? "No matching birthdays found" : "No upcoming birthdays"}
                </h3>
                <p className="text-gray-600">
                  {searchQuery ? "Try adjusting your search query" : "All clear for the next 7 days!"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                {getCurrentUpcomingPage().map((contact) => {
                  const daysUntil = getDaysUntilBirthday(contact.birthday)
                  const daysNumber = calculateDaysUntilBirthday(contact.birthday)
                  
                  return (
                    <div
                      key={contact.id}
                      className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 overflow-hidden group cursor-pointer"
                      onClick={() => {
                        setIsUpcomingModalOpen(false)
                        navigate(`/contacts/${contact.id}`)
                      }}
                    >
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl group-hover:scale-110 transition-transform">
                            {contact.first_name.charAt(0)}
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getBirthdayBadgeColor(daysNumber)}`}>
                            {daysUntil}
                          </div>
                        </div>
                        
                        <h3 className="font-semibold text-gray-900 text-lg mb-1">
                          {contact.first_name} {contact.last_name}
                        </h3>
                        
                        <p className="text-gray-600 text-sm mb-3">
                          {formatDate(contact.birthday)}
                        </p>
                        
                        <div className="space-y-1 text-sm text-gray-500">
                          {contact.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-3 h-3" />
                              <span className="truncate">{contact.email}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            <span>{contact.phone}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 group-hover:bg-blue-50 transition-colors">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">View Contact</span>
                          <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {upcomingPagination.totalPages > 1 && (
            <div className="flex-shrink-0 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {((upcomingPagination.page - 1) * upcomingPagination.pageSize + 1).toLocaleString()} to {Math.min(upcomingPagination.page * upcomingPagination.pageSize, upcomingPagination.totalCount).toLocaleString()} of {upcomingPagination.totalCount.toLocaleString()} birthdays
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prevUpcomingPage}
                    disabled={upcomingPagination.page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, upcomingPagination.totalPages) }, (_, i) => {
                      const pageNum = i + 1
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === upcomingPagination.page ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToUpcomingPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                    {upcomingPagination.totalPages > 5 && (
                      <span className="px-2 text-sm text-gray-500">...</span>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={nextUpcomingPage}
                    disabled={upcomingPagination.page === upcomingPagination.totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Empty States */}
      {todayBirthdays.length === 0 && next3DaysBirthdays.length === 0 && next7DaysBirthdays.length === 0 && stats.totalContacts > 0 && (
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