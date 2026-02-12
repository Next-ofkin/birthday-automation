import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle } from "lucide-react"
import { DashboardStats } from "@/types"

interface MessageStatsCardProps {
    stats: DashboardStats
}

export const MessageStatsCard = ({ stats }: MessageStatsCardProps) => {
    const getSuccessRate = () => {
        if (stats.totalMessages === 0) return 0
        return Math.round((stats.successfulMessages / stats.totalMessages) * 100)
    }

    const formatNumber = (num: number) => num.toLocaleString()

    return (
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
    )
}
