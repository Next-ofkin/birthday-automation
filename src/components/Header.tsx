import { useAuth } from "@/context/AuthContext"
import NotificationsPreview from "@/components/NotificationsPreview"

export function Header() {
  const { profile } = useAuth()

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        
        {/* LEFT SIDE */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Welcome back, {profile?.full_name?.split(" ")[0] || "User"}! 👋
          </h2>
          <p className="text-sm text-gray-600">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-4">

          {/* 🔔 NOTIFICATION BELL */}
          <NotificationsPreview />

          {/* USER BADGE */}
          <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
              {profile?.full_name?.charAt(0).toUpperCase() ||
                profile?.email?.charAt(0).toUpperCase()}
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-800">
                {profile?.full_name || profile?.email}
              </p>
              <p className="text-xs text-blue-600 capitalize">
                {profile?.role}
              </p>
            </div>
          </div>

        </div>
      </div>
    </header>
  )
}