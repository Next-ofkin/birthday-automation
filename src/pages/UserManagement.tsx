import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/context/AuthContext"
import { useNavigate } from "react-router-dom"
import { Search, Users, Shield, UserCog, User as UserIcon, Crown, CheckCircle, XCircle } from "lucide-react"

interface UserProfile {
    id: string
    email: string
    full_name: string | null
    role: 'developer' | 'admin' | 'customer_service' | 'user'
    created_at: string
    updated_at: string
}

export default function UserManagement() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [users, setUsers] = useState<UserProfile[]>([])
    const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [filterRole, setFilterRole] = useState<'all' | 'developer' | 'admin' | 'customer_service' | 'user'>('all')
    const [isLoading, setIsLoading] = useState(true)
    const [stats, setStats] = useState({
        total: 0,
        developers: 0,
        admins: 0,
        customerService: 0,
        regularUsers: 0
    })

    // Role Change Dialog State
    const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
    const [newRole, setNewRole] = useState<'developer' | 'admin' | 'customer_service' | 'user'>('user')
    const [isChangingRole, setIsChangingRole] = useState(false)
    const [roleChangeMessage, setRoleChangeMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const canManageUsers = ['developer', 'admin'].includes(profile?.role || '')
    const isDeveloper = profile?.role === 'developer'

    useEffect(() => {
        if (!canManageUsers) {
            navigate('/dashboard')
            return
        }
        fetchUsers()
    }, [canManageUsers, navigate])

    useEffect(() => {
        filterUsers()
    }, [searchQuery, filterRole, users])

    const fetchUsers = async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error

            setUsers(data || [])
            calculateStats(data || [])
        } catch (error) {
            console.error('Error fetching users:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const calculateStats = (userList: UserProfile[]) => {
        setStats({
            total: userList.length,
            developers: userList.filter(u => u.role === 'developer').length,
            admins: userList.filter(u => u.role === 'admin').length,
            customerService: userList.filter(u => u.role === 'customer_service').length,
            regularUsers: userList.filter(u => u.role === 'user').length
        })
    }

    const filterUsers = () => {
        let filtered = users

        if (filterRole !== 'all') {
            filtered = filtered.filter(u => u.role === filterRole)
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(u =>
                u.email.toLowerCase().includes(query) ||
                u.full_name?.toLowerCase().includes(query)
            )
        }

        setFilteredUsers(filtered)
    }

    const openRoleDialog = (user: UserProfile) => {
        setSelectedUser(user)
        setNewRole(user.role)
        setRoleChangeMessage(null)
        setIsRoleDialogOpen(true)
    }

    const handleRoleChange = async () => {
        if (!selectedUser) return
      
        setIsChangingRole(true)
        setRoleChangeMessage(null)
      
        try {
          console.log('Changing role for user:', selectedUser.id, 'to:', newRole) // Add this for debugging
      
          // Update the user's role in the database
          const { error } = await supabase
            .from('profiles')
            .update({ 
              role: newRole,
              updated_at: new Date().toISOString()
            })
            .eq('id', selectedUser.id)
      
          console.log('Update error:', error) // Add this for debugging
      
          if (error) throw error
      
          // Refresh user list
          await fetchUsers()
      
          setRoleChangeMessage({
            type: 'success',
            text: `Successfully changed ${selectedUser.full_name || selectedUser.email}'s role to ${formatRole(newRole)}`
          })
      
          setTimeout(() => {
            setIsRoleDialogOpen(false)
          }, 1500)
        } catch (error: any) {
          console.error('Error changing role:', error)
          setRoleChangeMessage({
            type: 'error',
            text: 'Failed to change role: ' + error.message
          })
        } finally {
          setIsChangingRole(false)
        }
      }

      const canChangeUserRole = (user: UserProfile) => {
        // Can't change your own role
        if (user.id === profile?.id) return false
        
        // Developers can change any role (except their own)
        if (isDeveloper) return true
        
        // Admins can change user and customer_service roles
        // This means: if the target user is NOT a developer, admin can change them
        if (profile?.role === 'admin') {
          // Admin can change users who are currently 'user' or 'customer_service'
          // Admin CANNOT change 'developer' or 'admin' accounts
          return user.role === 'user' || user.role === 'customer_service'
        }
        
        return false
      }

    const getAvailableRoles = () => {
        if (isDeveloper) {
            // Developers can assign any role
            return [
                { value: 'user', label: 'User', icon: <UserIcon className="w-4 h-4" /> },
                { value: 'customer_service', label: 'Customer Service', icon: <UserCog className="w-4 h-4" /> },
                { value: 'admin', label: 'Admin', icon: <Shield className="w-4 h-4" /> },
                { value: 'developer', label: 'Developer', icon: <Crown className="w-4 h-4" /> },
            ]
        } else {
            // Admins can only assign user and customer_service roles
            return [
                { value: 'user', label: 'User', icon: <UserIcon className="w-4 h-4" /> },
                { value: 'customer_service', label: 'Customer Service', icon: <UserCog className="w-4 h-4" /> },
            ]
        }
    }

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'developer':
                return <Crown className="w-4 h-4" />
            case 'admin':
                return <Shield className="w-4 h-4" />
            case 'customer_service':
                return <UserCog className="w-4 h-4" />
            default:
                return <UserIcon className="w-4 h-4" />
        }
    }

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'developer':
                return 'bg-purple-100 text-purple-800'
            case 'admin':
                return 'bg-blue-100 text-blue-800'
            case 'customer_service':
                return 'bg-green-100 text-green-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const formatRole = (role: string) => {
        switch (role) {
            case 'customer_service':
                return 'Customer Service'
            default:
                return role.charAt(0).toUpperCase() + role.slice(1)
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading users...</p>
                </div>
            </div>
        )
    }

    if (!canManageUsers) {
        return null
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                    <p className="text-gray-600 mt-1">Manage system users and their roles</p>
                </div>
                <Users className="w-8 h-8 text-gray-400" />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600">Developers</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-purple-600">{stats.developers}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600">Admins</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{stats.admins}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600">Customer Service</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{stats.customerService}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600">Regular Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-gray-600">{stats.regularUsers}</div>
                    </CardContent>
                </Card>
            </div>

            {/* User List */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <CardTitle>👥 All Users ({filteredUsers.length})</CardTitle>
                        <div className="flex flex-col sm:flex-row gap-3">
                            {/* Role Filter */}
                            <div className="flex gap-2 flex-wrap">
                                <Button
                                    variant={filterRole === 'all' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFilterRole('all')}
                                >
                                    All
                                </Button>
                                <Button
                                    variant={filterRole === 'developer' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFilterRole('developer')}
                                >
                                    <Crown className="w-4 h-4 mr-1" />
                                    Developers
                                </Button>
                                <Button
                                    variant={filterRole === 'admin' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFilterRole('admin')}
                                >
                                    <Shield className="w-4 h-4 mr-1" />
                                    Admins
                                </Button>
                                <Button
                                    variant={filterRole === 'customer_service' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFilterRole('customer_service')}
                                >
                                    <UserCog className="w-4 h-4 mr-1" />
                                    CS
                                </Button>
                                <Button
                                    variant={filterRole === 'user' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFilterRole('user')}
                                >
                                    <UserIcon className="w-4 h-4 mr-1" />
                                    Users
                                </Button>
                            </div>

                            {/* Search */}
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search users..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredUsers.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">👥</div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">
                                {searchQuery || filterRole !== 'all' ? "No users found" : "No users yet"}
                            </h3>
                            <p className="text-gray-600">
                                {searchQuery || filterRole !== 'all'
                                    ? "Try adjusting your filters or search query"
                                    : "Users will appear here when they sign up"}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Member Since</TableHead>
                                        <TableHead>Last Updated</TableHead>
                                        {canManageUsers && <TableHead>Actions</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                                                        {user.full_name
                                                            ? user.full_name.charAt(0).toUpperCase()
                                                            : user.email.charAt(0).toUpperCase()
                                                        }
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900">
                                                            {user.full_name || 'No name'}
                                                        </div>
                                                        {user.id === profile?.id && (
                                                            <span className="text-xs text-blue-600 font-medium">(You)</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm text-gray-600">{user.email}</div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                                                    {getRoleIcon(user.role)}
                                                    {formatRole(user.role)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm text-gray-600">
                                                    {formatDate(user.created_at)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm text-gray-600">
                                                    {formatDate(user.updated_at)}
                                                </div>
                                            </TableCell>
                                            {canManageUsers && (
                                                <TableCell>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openRoleDialog(user)}
                                                        disabled={!canChangeUserRole(user)}
                                                    >
                                                        Change Role
                                                    </Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Role Change Dialog */}
            <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change User Role</DialogTitle>
                        <DialogDescription>
                            Update the role for {selectedUser?.full_name || selectedUser?.email}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Current Role</Label>
                            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${getRoleBadgeColor(selectedUser?.role || 'user')}`}>
                                {getRoleIcon(selectedUser?.role || 'user')}
                                <span className="font-medium">{formatRole(selectedUser?.role || 'user')}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>New Role</Label>
                            <div className="grid grid-cols-1 gap-2">
                                {getAvailableRoles().map((role) => (
                                    <label
                                        key={role.value}
                                        className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${newRole === role.value
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="role"
                                            value={role.value}
                                            checked={newRole === role.value}
                                            onChange={(e) => setNewRole(e.target.value as any)}
                                            className="w-4 h-4"
                                        />
                                        <div className="flex items-center gap-2">
                                            {role.icon}
                                            <span className="font-medium">{role.label}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {roleChangeMessage && (
                            <div className={`p-3 rounded-lg border ${roleChangeMessage.type === 'success'
                                    ? 'bg-green-50 border-green-200 text-green-800'
                                    : 'bg-red-50 border-red-200 text-red-800'
                                }`}>
                                <div className="flex items-center gap-2">
                                    {roleChangeMessage.type === 'success' ? (
                                        <CheckCircle className="w-4 h-4" />
                                    ) : (
                                        <XCircle className="w-4 h-4" />
                                    )}
                                    <span className="text-sm font-medium">{roleChangeMessage.text}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsRoleDialogOpen(false)}
                            disabled={isChangingRole}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRoleChange}
                            disabled={isChangingRole || newRole === selectedUser?.role}
                        >
                            {isChangingRole ? 'Changing...' : 'Change Role'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}