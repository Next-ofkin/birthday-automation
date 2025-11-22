import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              🎉 Today's Birthdays
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-blue-600">0</p>
            <p className="text-sm text-gray-600">No birthdays today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              📅 Upcoming (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-purple-600">0</p>
            <p className="text-sm text-gray-600">Next week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              👥 Total Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-green-600">3</p>
            <p className="text-sm text-gray-600">In database</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl">✉️</div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">Birthday message sent</p>
                <p className="text-sm text-gray-600">John Doe - 2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl">👤</div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">New contact added</p>
                <p className="text-sm text-gray-600">Jane Smith - 5 hours ago</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl">📝</div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">Template updated</p>
                <p className="text-sm text-gray-600">Default Birthday SMS - Yesterday</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle>🚀 Project Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Milestones Completed</span>
              <span className="text-sm font-bold text-blue-600">18%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full" style={{ width: '18%' }}></div>
            </div>
            <p className="text-xs text-gray-500">9 of 50 milestones completed 🎯</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}