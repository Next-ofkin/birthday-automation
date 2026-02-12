import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Mail, Users } from "lucide-react"
import { useAuth } from "@/context/AuthContext"

export const QuickActions = () => {
    const { profile } = useAuth()
    const navigate = useNavigate()

    if (!profile || (profile.role !== 'developer' && profile.role !== 'admin' && profile.role !== 'customer_service')) {
        return null
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>⚡ Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                        className="h-20 flex flex-col gap-2"
                        variant="outline"
                        onClick={() => navigate('/contacts')}
                    >
                        <Plus className="w-6 h-6" />
                        <span>Add Contact</span>
                    </Button>
                    <Button
                        className="h-20 flex flex-col gap-2"
                        variant="outline"
                        onClick={() => navigate('/templates')}
                    >
                        <Mail className="w-6 h-6" />
                        <span>Create Template</span>
                    </Button>
                    <Button
                        className="h-20 flex flex-col gap-2"
                        variant="outline"
                        onClick={() => navigate('/bulk-upload')}
                    >
                        <Users className="w-6 h-6" />
                        <span>Bulk Upload</span>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
