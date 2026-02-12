export interface Contact {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string
    birthday: string
    is_active: boolean
}

export interface ActivityLog {
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

export interface DashboardStats {
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
