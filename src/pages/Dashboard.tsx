import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { StatsGrid } from "@/components/dashboard/StatsGrid"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { BirthdayListCard } from "@/components/dashboard/BirthdayListCard"
import { MessageStatsCard } from "@/components/dashboard/MessageStatsCard"
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard"
import { SystemStatusCard } from "@/components/dashboard/SystemStatusCard"
import { UpcomingBirthdaysModal } from "@/components/dashboard/UpcomingBirthdaysModal"
import { useDashboardData } from "@/hooks/useDashboardData"

export default function Dashboard() {
  const navigate = useNavigate()
  const {
    stats,
    todayBirthdays,
    next3DaysBirthdays,
    next7DaysBirthdays,
    recentActivity,
    isLoading
  } = useDashboardData()

  const [isUpcomingModalOpen, setIsUpcomingModalOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <DashboardHeader />

      <StatsGrid stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          <QuickActions />

          {todayBirthdays.length > 0 && (
            <BirthdayListCard
              title="🎉 Today's Birthdays"
              count={todayBirthdays.length}
              contacts={todayBirthdays}
              colorTheme="purple"
              actionLabel="View All Contacts"
              onAction={() => navigate('/contacts')}
            />
          )}

          {next3DaysBirthdays.length > 0 && (
            <BirthdayListCard
              title="⏰ Next 3 Days"
              count={next3DaysBirthdays.length}
              contacts={next3DaysBirthdays}
              colorTheme="orange"
              actionLabel="View All Upcoming"
              onAction={() => setIsUpcomingModalOpen(true)}
              showBadges={true}
            />
          )}

          {next7DaysBirthdays.length > 0 && (
            <BirthdayListCard
              title="📅 This Week"
              count={stats.next7DaysBirthdays}
              contacts={next7DaysBirthdays}
              colorTheme="blue"
              actionLabel="View All"
              onAction={() => setIsUpcomingModalOpen(true)}
              viewAllLink="/contacts"
              showBadges={true}
            />
          )}

          {/* Empty State */}
          {todayBirthdays.length === 0 && next3DaysBirthdays.length === 0 && next7DaysBirthdays.length === 0 && stats.totalContacts > 0 && (
            <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
              <div className="text-6xl mb-4">🎂</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Upcoming Birthdays</h3>
              <p className="text-gray-600">
                All clear for the next 7 days! Time to relax. 😊
              </p>
            </div>
          )}

          {stats.totalContacts === 0 && (
            <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Contacts Yet</h3>
              <p className="text-gray-600 mb-6">
                Get started by adding your first contact!
              </p>
              <button
                onClick={() => navigate('/contacts')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
              >
                Add First Contact
              </button>
            </div>
          )}
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          <MessageStatsCard stats={stats} />
          <RecentActivityCard logs={recentActivity} />
          <SystemStatusCard stats={stats} />
        </div>
      </div>

      <UpcomingBirthdaysModal
        isOpen={isUpcomingModalOpen}
        onClose={() => setIsUpcomingModalOpen(false)}
      />
    </div>
  )
}