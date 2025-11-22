import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"

interface ComingSoonProps {
  title: string
  icon: string
  description: string
  features?: string[]
}

export default function ComingSoon({ title, icon, description, features = [] }: ComingSoonProps) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="text-6xl mb-4">{icon}</div>
          <CardTitle className="text-3xl">{title}</CardTitle>
          <p className="text-gray-600 mt-2">{description}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {features.length > 0 && (
            <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-3">Coming Features:</h3>
              <ul className="space-y-2">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-blue-800">
                    <span className="text-blue-600">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-800 text-center">
              ✅ <strong>Progress:</strong> 20% Complete • 10 of 50 milestones done
            </p>
          </div>

          <div className="flex justify-center">
            <Button onClick={() => navigate('/dashboard')} size="lg">
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}