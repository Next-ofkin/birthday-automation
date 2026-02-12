import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardStats } from "@/types"

interface SystemStatusCardProps {
    stats: DashboardStats
}

export const SystemStatusCard = ({ stats }: SystemStatusCardProps) => {
    const formatNumber = (num: number) => num.toLocaleString()

    return (
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
    )
}
