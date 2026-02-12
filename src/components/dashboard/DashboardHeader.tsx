import { useAuth } from "@/context/AuthContext"

export const DashboardHeader = () => {
    const { profile } = useAuth()

    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return "Good Morning"
        if (hour < 18) return "Good Afternoon"
        return "Good Evening"
    }

    return (
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
    )
}
