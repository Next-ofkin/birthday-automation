import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Users, MessageSquare, Send, Settings as SettingsIcon } from "lucide-react"
import { ActivityLog } from "@/types"

interface RecentActivityCardProps {
    logs: ActivityLog[]
}

export const RecentActivityCard = ({ logs }: RecentActivityCardProps) => {
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

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">📝 Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
                {logs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                        No recent activity
                    </div>
                ) : (
                    <div className="space-y-3">
                        {logs.slice(0, 8).map((activity) => (
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
    )
}
