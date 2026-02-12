import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Cake, Calendar } from "lucide-react"
import { DashboardStats } from "@/types"

interface StatsGridProps {
    stats: DashboardStats
}

export const StatsGrid = ({ stats }: StatsGridProps) => {
    const navigate = useNavigate()

    const formatNumber = (num: number) => num.toLocaleString()

    return (
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
    )
}
