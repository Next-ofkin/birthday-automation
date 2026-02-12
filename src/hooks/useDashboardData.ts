import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Contact, ActivityLog, DashboardStats } from "@/types"

export const useDashboardData = () => {
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

    const calculateDaysUntilBirthday = (birthdayString: string): number => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const birthday = new Date(birthdayString)
        const thisYearBirthday = new Date(
            today.getFullYear(),
            birthday.getMonth(),
            birthday.getDate()
        )

        if (thisYearBirthday < today) {
            thisYearBirthday.setFullYear(today.getFullYear() + 1)
        }

        const diffTime = thisYearBirthday.getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        return diffDays
    }

    const fetchTodaysBirthdays = async (): Promise<Contact[]> => {
        const today = new Date()
        const todayMonth = today.getMonth() + 1
        const todayDay = today.getDate()

        try {
            const { data, error } = await supabase
                .from('contacts')
                .select('id, first_name, last_name, email, phone, birthday, is_active')
                .eq('is_active', true)

            if (error) throw error

            return (data || []).filter(contact => {
                const birthday = new Date(contact.birthday)
                return birthday.getMonth() + 1 === todayMonth && birthday.getDate() === todayDay
            })
        } catch (error) {
            console.error('Error fetching today birthdays:', error)
            return []
        }
    }

    const fetchNext3DaysBirthdays = async (): Promise<Contact[]> => {
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select('id, first_name, last_name, email, phone, birthday, is_active')
                .eq('is_active', true)

            if (error) throw error

            const filteredData = (data || []).filter(contact => {
                const daysUntil = calculateDaysUntilBirthday(contact.birthday)
                return daysUntil >= 1 && daysUntil <= 3
            })

            filteredData.sort((a, b) => {
                return calculateDaysUntilBirthday(a.birthday) - calculateDaysUntilBirthday(b.birthday)
            })

            return filteredData
        } catch (error) {
            console.error('Error fetching next 3 days birthdays:', error)
            return []
        }
    }

    const fetchNext7DaysBirthdays = async (): Promise<Contact[]> => {
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select('id, first_name, last_name, email, phone, birthday, is_active')
                .eq('is_active', true)

            if (error) throw error

            const filteredData = (data || []).filter(contact => {
                const daysUntil = calculateDaysUntilBirthday(contact.birthday)
                return daysUntil >= 1 && daysUntil <= 7
            })

            filteredData.sort((a, b) => {
                return calculateDaysUntilBirthday(a.birthday) - calculateDaysUntilBirthday(b.birthday)
            })

            return filteredData.slice(0, 5) // Limit to top 5 for dashboard summary
        } catch (error) {
            console.error('Error fetching next 7 days birthdays:', error)
            return []
        }
    }

    const fetchDashboardData = useCallback(async () => {
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
            setRecentActivity(activitiesData.data as ActivityLog[] || [])

        } catch (error) {
            console.error('Error fetching dashboard data:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchDashboardData()
    }, [fetchDashboardData])

    return {
        stats,
        todayBirthdays,
        next3DaysBirthdays,
        next7DaysBirthdays,
        recentActivity,
        isLoading,
        refreshData: fetchDashboardData,
        calculateDaysUntilBirthday // Export helper in case needed by UI components
    }
}
