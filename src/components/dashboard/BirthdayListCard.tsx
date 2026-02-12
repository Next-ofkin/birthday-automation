import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, Gift, ArrowRight } from "lucide-react"
import { Contact } from "@/types"

interface BirthdayListCardProps {
    title: string
    count: number
    contacts: Contact[]
    colorTheme: 'purple' | 'orange' | 'blue'
    actionLabel?: string
    onAction?: () => void
    viewAllLink?: string
    emptyMessage?: string
    showBadges?: boolean
}

export const BirthdayListCard = ({
    title,
    count,
    contacts,
    colorTheme,
    actionLabel,
    onAction,
    viewAllLink,
    emptyMessage = "No birthdays found",
    showBadges = false
}: BirthdayListCardProps) => {
    const navigate = useNavigate()

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

    const formatShortDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    // Theme styles
    const themeStyles = {
        purple: {
            bg: 'bg-purple-50',
            border: 'border-purple-200',
            text: 'text-purple-600',
            avatarGradient: 'from-purple-500 to-pink-600'
        },
        orange: {
            bg: 'bg-orange-50',
            border: 'border-orange-200',
            text: 'text-orange-600',
            avatarGradient: 'from-orange-500 to-red-500'
        },
        blue: {
            bg: 'bg-gradient-to-r from-blue-50 to-purple-50', // Special gradient for blue/week
            border: 'border-blue-200',
            text: 'text-blue-600',
            avatarGradient: 'from-blue-500 to-purple-600'
        }
    }

    const theme = themeStyles[colorTheme]

    if (contacts.length === 0) return null

    return (
        <Card className={`${theme.border} ${theme.bg}`}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        {title} ({count})
                    </CardTitle>
                    <div className="flex gap-2">
                        {onAction && actionLabel && (
                            <Button variant="outline" size="sm" onClick={onAction}>
                                {actionLabel}
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        )}
                        {viewAllLink && (
                            <Button variant="outline" size="sm" onClick={() => navigate(viewAllLink)}>
                                All Contacts
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {contacts.slice(0, 5).map((contact) => {
                        const daysUntil = getDaysUntilBirthday(contact.birthday)
                        const daysNumber = calculateDaysUntilBirthday(contact.birthday)

                        return (
                            <div
                                key={contact.id}
                                className={`flex items-center justify-between p-4 bg-white rounded-lg border ${theme.border} hover:shadow-md transition-all cursor-pointer group`}
                                onClick={() => navigate(`/contacts/${contact.id}`)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${theme.avatarGradient} flex items-center justify-center text-white font-bold group-hover:scale-110 transition-transform`}>
                                        {contact.first_name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-900">
                                            {contact.first_name} {contact.last_name}
                                        </div>
                                        <div className="text-sm text-gray-600">{contact.email || formatShortDate(contact.birthday)}</div>
                                    </div>
                                </div>

                                {showBadges ? (
                                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getBirthdayBadgeColor(daysNumber)}`}>
                                        <Clock className="w-3 h-3" />
                                        {daysUntil}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Gift className={`w-5 h-5 ${theme.text}`} />
                                        <span className="text-lg">🎂</span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
                {count > 5 && onAction && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={onAction}
                        >
                            View {count - 5} more birthdays
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
