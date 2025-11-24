import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function NotificationsPreview() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  // If not logged in, don't render
  if (!user) return null

  // Count unread notifications
  const loadUnread = async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("is_read")
      .eq("user_id", user.id)

    if (error) return

    const unread = data.filter((n) => !n.is_read).length
    setUnreadCount(unread)
  }

  useEffect(() => {
    if (!user) return

    loadUnread()

    // Realtime subscribe
    const channel = supabase
      .channel("notification-badge")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setUnreadCount((prev) => prev + 1)

          toast.info(payload.new.title, {
            description: payload.new.message,
          })
        }
      )
      .subscribe()

    // Cleanup
    return () => {
      channel.unsubscribe()
    }
  }, [user])

  return (
    <Button
      variant="outline"
      size="icon"
      className="relative"
      onClick={() => (window.location.href = "/notifications")}
    >
      <Bell className="w-5 h-5" />

      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Button>
  )
}
