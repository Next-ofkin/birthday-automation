import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { 
  Home, 
  Users, 
  MessageSquare, 
  Settings, 
  BarChart3,
  Upload,
  Bell,
  LogOut,
  Menu,
  X
} from "lucide-react"
import { Button } from "./ui/button"
import { useState } from "react"

interface MenuItem {
  name: string
  path: string
  icon: React.ReactNode
  roles: string[]
}

export function Sidebar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)

  const menuItems: MenuItem[] = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <Home className="w-5 h-5" />,
      roles: ["developer", "admin", "customer_service", "user"]
    },
    {
      name: "Contacts",
      path: "/contacts",
      icon: <Users className="w-5 h-5" />,
      roles: ["developer", "admin", "customer_service", "user"]
    },
    {
      name: "Templates",
      path: "/templates",
      icon: <MessageSquare className="w-5 h-5" />,
      roles: ["developer", "admin", "customer_service"]
    },
    {
      name: "Bulk Upload",
      path: "/bulk-upload",
      icon: <Upload className="w-5 h-5" />,
      roles: ["developer", "admin", "customer_service"]
    },
    {
      name: "Analytics",
      path: "/analytics",
      icon: <BarChart3 className="w-5 h-5" />,
      roles: ["developer", "admin"]
    },
    {
      name: "Notifications",
      path: "/notifications",
      icon: <Bell className="w-5 h-5" />,
      roles: ["developer", "admin", "customer_service", "user"]
    },
    {
      name: "Settings",
      path: "/settings",
      icon: <Settings className="w-5 h-5" />,
      roles: ["developer", "admin"]
    }
  ]

  const filteredMenuItems = menuItems.filter(item =>
    item.roles.includes(profile?.role || "user")
  )

  const handleLogout = async () => {
    await signOut()
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-gradient-to-b from-gray-900 to-gray-800 text-white
          w-64 transform transition-transform duration-300 ease-in-out z-40
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🎂</div>
              <div>
                <h1 className="text-xl font-bold">Birthday-Bot</h1>
                <p className="text-xs text-gray-400">Never miss a birthday</p>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                {profile?.full_name?.charAt(0).toUpperCase() || profile?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.full_name || profile?.email}
                </p>
                <p className="text-xs text-gray-400 capitalize">
                  {profile?.role}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {filteredMenuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                  ${isActive(item.path)
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }
                `}
              >
                {item.icon}
                <span className="font-medium">{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-gray-700">
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full bg-transparent border-gray-600 text-gray-300 hover:bg-red-600 hover:text-white hover:border-red-600"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}