import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Contact } from "@/types"

interface PaginationState {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
}

export const useUpcomingBirthdays = (isOpen: boolean) => {
    const [allUpcomingBirthdays, setAllUpcomingBirthdays] = useState<Contact[]>([])
    const [filteredUpcomingBirthdays, setFilteredUpcomingBirthdays] = useState<Contact[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [pagination, setPagination] = useState<PaginationState>({
        page: 1,
        pageSize: 12,
        totalCount: 0,
        totalPages: 0
    })

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

    const fetchExpectedBirthdays = async (): Promise<Contact[]> => {
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

            return filteredData
        } catch (error) {
            console.error('Error fetching all upcoming birthdays:', error)
            return []
        }
    }

    const fetchAll = useCallback(async () => {
        if (!isOpen) return

        const data = await fetchExpectedBirthdays()
        setAllUpcomingBirthdays(data)

        // Initial filter set (same as all)
        setFilteredUpcomingBirthdays(data)
        setPagination(prev => ({
            ...prev,
            totalCount: data.length,
            totalPages: Math.ceil(data.length / prev.pageSize),
            page: 1
        }))
    }, [isOpen])

    useEffect(() => {
        fetchAll()
    }, [fetchAll])

    // Handle Search Filtering
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredUpcomingBirthdays(allUpcomingBirthdays)
            setPagination(prev => ({
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
            (contact.email && contact.email.toLowerCase().includes(query)) ||
            contact.phone.includes(query)
        )

        setFilteredUpcomingBirthdays(filtered)
        setPagination(prev => ({
            ...prev,
            totalCount: filtered.length,
            totalPages: Math.ceil(filtered.length / prev.pageSize),
            page: 1
        }))
    }, [searchQuery, allUpcomingBirthdays])

    // Pagination Helpers
    const getCurrentPageItems = () => {
        const startIndex = (pagination.page - 1) * pagination.pageSize
        const endIndex = startIndex + pagination.pageSize
        return filteredUpcomingBirthdays.slice(startIndex, endIndex)
    }

    const goToPage = (page: number) => {
        setPagination(prev => ({ ...prev, page }))
    }

    const nextPage = () => {
        if (pagination.page < pagination.totalPages) {
            setPagination(prev => ({ ...prev, page: prev.page + 1 }))
        }
    }

    const prevPage = () => {
        if (pagination.page > 1) {
            setPagination(prev => ({ ...prev, page: prev.page - 1 }))
        }
    }

    return {
        upcomingBirthdays: filteredUpcomingBirthdays,
        searchQuery,
        setSearchQuery,
        pagination,
        getCurrentPageItems,
        goToPage,
        nextPage,
        prevPage,
        calculateDaysUntilBirthday
    }
}
