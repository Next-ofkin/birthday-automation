import { useNavigate } from "react-router-dom"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar, X, Search, Mail, Phone, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { useUpcomingBirthdays } from "@/hooks/useUpcomingBirthdays"

interface UpcomingBirthdaysModalProps {
    isOpen: boolean
    onClose: () => void
}

export const UpcomingBirthdaysModal = ({ isOpen, onClose }: UpcomingBirthdaysModalProps) => {
    const navigate = useNavigate()
    const {
        upcomingBirthdays,
        searchQuery,
        setSearchQuery,
        pagination,
        getCurrentPageItems,
        goToPage,
        nextPage,
        prevPage,
        calculateDaysUntilBirthday
    } = useUpcomingBirthdays(isOpen)

    const getDaysUntilBirthday = (birthday: string) => {
        const daysUntil = calculateDaysUntilBirthday(birthday)
        if (daysUntil === 0) return "🎉 Today!"
        if (daysUntil === 1) return "🎂 Tomorrow"
        return `📅 In ${daysUntil} days`
    }

    const getBirthdayBadgeColor = (daysUntil: number) => {
        if (daysUntil === 0) return "bg-gradient-to-r from-purple-500 to-pink-600 text-white"
        if (daysUntil === 1) return "bg-gradient-to-r from-orange-500 to-red-500 text-white"
        if (daysUntil <= 3) return "bg-gradient-to-r from-yellow-500 to-orange-500 text-white"
        return "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2 text-2xl">
                            <Calendar className="w-6 h-6 text-orange-600" />
                            Upcoming Birthdays - Next 7 Days ({upcomingBirthdays.length})
                        </DialogTitle>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-shrink-0 border-b pb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search upcoming birthdays..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    {getCurrentPageItems().length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">🎂</div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">
                                {searchQuery ? "No matching birthdays found" : "No upcoming birthdays"}
                            </h3>
                            <p className="text-gray-600">
                                {searchQuery ? "Try adjusting your search query" : "All clear for the next 7 days!"}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                            {getCurrentPageItems().map((contact) => {
                                const daysUntil = getDaysUntilBirthday(contact.birthday)
                                const daysNumber = calculateDaysUntilBirthday(contact.birthday)

                                return (
                                    <div
                                        key={contact.id}
                                        className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 overflow-hidden group cursor-pointer"
                                        onClick={() => {
                                            onClose()
                                            navigate(`/contacts/${contact.id}`)
                                        }}
                                    >
                                        <div className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl group-hover:scale-110 transition-transform">
                                                    {contact.first_name.charAt(0)}
                                                </div>
                                                <div className={`px-3 py-1 rounded-full text-sm font-medium ${getBirthdayBadgeColor(daysNumber)}`}>
                                                    {daysUntil}
                                                </div>
                                            </div>

                                            <h3 className="font-semibold text-gray-900 text-lg mb-1">
                                                {contact.first_name} {contact.last_name}
                                            </h3>

                                            <p className="text-gray-600 text-sm mb-3">
                                                {formatDate(contact.birthday)}
                                            </p>

                                            <div className="space-y-1 text-sm text-gray-500">
                                                {contact.email && (
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="w-3 h-3" />
                                                        <span className="truncate">{contact.email}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <Phone className="w-3 h-3" />
                                                    <span>{contact.phone}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 group-hover:bg-blue-50 transition-colors">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600">View Contact</span>
                                                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                    <div className="flex-shrink-0 border-t pt-4">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                                Showing {((pagination.page - 1) * pagination.pageSize + 1).toLocaleString()} to {Math.min(pagination.page * pagination.pageSize, pagination.totalCount).toLocaleString()} of {pagination.totalCount.toLocaleString()} birthdays
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={prevPage}
                                    disabled={pagination.page === 1}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>

                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                        const pageNum = i + 1
                                        return (
                                            <Button
                                                key={pageNum}
                                                variant={pageNum === pagination.page ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => goToPage(pageNum)}
                                            >
                                                {pageNum}
                                            </Button>
                                        )
                                    })}
                                    {pagination.totalPages > 5 && (
                                        <span className="px-2 text-sm text-gray-500">...</span>
                                    )}
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={nextPage}
                                    disabled={pagination.page === pagination.totalPages}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
