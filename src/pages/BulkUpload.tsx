import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useNavigate } from "react-router-dom"
import { 
  Upload, 
  CheckCircle, 
  AlertCircle,
  Download,
  Loader2,
  Shield,
  Link as LinkIcon,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search
} from "lucide-react"
import Papa from "papaparse"
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ParsedContact {
  first_name: string
  last_name: string
  email: string
  phone: string
  birthday: string
  notes?: string
  row: number
  isValid: boolean
  errors: string[]
  isDuplicate?: boolean
  duplicateReason?: string
  skipUpload?: boolean
}

interface UploadStats {
  total: number
  valid: number
  invalid: number
  duplicates: number
  newContacts: number
  existingContacts: number
  skippedByUser: number
}

type ViewMode = 'all' | 'valid' | 'invalid' | 'duplicates' | 'ready'

export default function BulkUpload() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file')
  const [fileUrl, setFileUrl] = useState('')
  const [isLoadingUrl, setIsLoadingUrl] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedContact[]>([])
  const [stats, setStats] = useState<UploadStats>({ 
    total: 0, 
    valid: 0, 
    invalid: 0, 
    duplicates: 0,
    newContacts: 0,
    existingContacts: 0,
    skippedByUser: 0
  })
  const [uploadComplete, setUploadComplete] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ success: number, failed: number } | null>(null)
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Check permissions
  const canUpload = ['developer', 'admin', 'customer_service'].includes(profile?.role || '')

  if (!canUpload) {
    navigate('/dashboard')
    return null
  }

  // Filter data based on view mode and search
  const filteredData = parsedData.filter(contact => {
    // Search filter
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = !searchTerm || 
      contact.first_name.toLowerCase().includes(searchLower) ||
      contact.last_name.toLowerCase().includes(searchLower) ||
      contact.email.toLowerCase().includes(searchLower) ||
      contact.phone.includes(searchTerm)

    if (!matchesSearch) return false

    // View mode filter
    switch (viewMode) {
      case 'valid':
        return contact.isValid && !contact.isDuplicate
      case 'invalid':
        return !contact.isValid
      case 'duplicates':
        return contact.isDuplicate
      case 'ready':
        return contact.isValid && !contact.skipUpload
      case 'all':
      default:
        return true
    }
  })

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [viewMode, searchTerm])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase()
    
    if (!validTypes.includes(selectedFile.type) && !['csv', 'xls', 'xlsx'].includes(fileExtension || '')) {
      toast.error('Invalid File Type', {
        description: 'Please upload a CSV or Excel file'
      })
      return
    }

    // Check file size (10MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error('File Too Large', {
        description: 'Maximum file size is 10MB. Please upload a smaller file.'
      })
      return
    }

    toast.success('File Selected', {
      description: `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(0)} KB)`
    })

    setFile(selectedFile)
    resetPreviewData()
    parseFile(selectedFile)
  }

  const handleGoogleSheetsAlternative = () => {
    console.log('🔄 Using alternative Google Sheets method')
    
    toast.info('Google Sheets Direct Access Unavailable', {
      description: 'For best results, download your sheet as CSV and upload it directly.',
      duration: 5000,
    })
    
    // Switch to file upload mode
    setUploadMethod('file')
  }

  const handleUrlUpload = async () => {
    if (!fileUrl.trim()) {
      toast.error('Invalid URL', {
        description: 'Please enter a valid URL'
      })
      return
    }

    setIsLoadingUrl(true)
    resetPreviewData()

    try {
      let fetchUrl = fileUrl.trim()
      
      // Convert Google Sheets URL to CSV export URL
      if (fetchUrl.includes('docs.google.com/spreadsheets')) {
        console.log('📊 Detected Google Sheets URL')
        
        const sheetIdMatch = fetchUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)
        if (sheetIdMatch) {
          const sheetId = sheetIdMatch[1]
          const gidMatch = fetchUrl.match(/[#&]gid=([0-9]+)/)
          const gid = gidMatch ? gidMatch[1] : '0'
          
          fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`
          console.log('✅ Converted to export URL:', fetchUrl)
          
          toast.loading('Accessing Google Sheets...', { id: 'url-load' })
        } else {
          toast.error('Invalid Google Sheets URL', {
            description: 'Please copy the full URL from your browser.'
          })
          setIsLoadingUrl(false)
          return
        }
      }
      
      // Convert Google Drive shareable link to direct download
      else if (fetchUrl.includes('drive.google.com/file')) {
        console.log('📁 Detected Google Drive file URL')
        
        const fileIdMatch = fetchUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)
        if (fileIdMatch) {
          const fileId = fileIdMatch[1]
          fetchUrl = `https://drive.google.com/uc?export=download&id=${fileId}`
          console.log('✅ Converted to direct download URL:', fetchUrl)
          
          toast.loading('Downloading from Google Drive...', { id: 'url-load' })
        } else {
          toast.error('Invalid Google Drive URL', {
            description: 'Please use a shareable link.'
          })
          setIsLoadingUrl(false)
          return
        }
      } else {
        toast.loading('Downloading file...', { id: 'url-load' })
      }
      
      const response = await fetch(fetchUrl, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        credentials: 'omit'
      })
      
      if (!response.ok) {
        if (fetchUrl.includes('docs.google.com')) {
          console.log('🔄 Google Sheets export failed, trying alternative method...')
          toast.dismiss('url-load')
          handleGoogleSheetsAlternative()
          return
        }
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()
      console.log('📦 File downloaded:', blob.size, 'bytes, type:', blob.type)
      
      if (blob.type.includes('html') || blob.size < 100) {
        console.log('⚠️ Received HTML instead of CSV, trying alternative method...')
        toast.dismiss('url-load')
        handleGoogleSheetsAlternative()
        return
      }
      
      let fileName = 'upload.csv'
      let fileType = blob.type
      
      if (fetchUrl.includes('gviz/tq') || fileType.includes('csv') || fileType.includes('text')) {
        fileName = 'google-sheets-export.csv'
        fileType = 'text/csv'
      } else if (fetchUrl.endsWith('.xlsx') || fileType.includes('spreadsheet')) {
        fileName = 'upload.xlsx'
      } else if (fetchUrl.endsWith('.xls')) {
        fileName = 'upload.xls'
      }
      
      const file = new File([blob], fileName, { type: fileType })
      console.log('✅ File created:', fileName, 'Size:', file.size)
      
      toast.success('File Loaded Successfully', {
        description: `${fileName} (${(file.size / 1024).toFixed(0)} KB)`,
        id: 'url-load'
      })
      
      setFile(file)
      parseFile(file)
      
    } catch (error) {
      console.error('❌ Error fetching URL:', error)
      
      if (fileUrl.includes('docs.google.com')) {
        console.log('🔄 Trying alternative Google Sheets method...')
        toast.dismiss('url-load')
        handleGoogleSheetsAlternative()
        return
      }
      
      let errorMessage = 'Failed to load file from URL'
      
      if (error instanceof Error) {
        if (error.message.includes('CORS')) {
          errorMessage = 'Security restrictions prevent direct access'
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Cannot access the URL. Check if it\'s publicly accessible'
        } else {
          errorMessage = error.message
        }
      }
      
      toast.error('Failed to Load File', {
        description: errorMessage,
        id: 'url-load'
      })
    } finally {
      setIsLoadingUrl(false)
    }
  }

  const resetPreviewData = () => {
    setParsedData([])
    setStats({ 
      total: 0, 
      valid: 0, 
      invalid: 0, 
      duplicates: 0,
      newContacts: 0,
      existingContacts: 0,
      skippedByUser: 0
    })
    setUploadComplete(false)
    setUploadResult(null)
    setCurrentPage(1)
    setViewMode('all')
    setSearchTerm('')
  }

  const confirmClearAll = () => {
    setFile(null)
    setFileUrl('')
    resetPreviewData()
    setShowClearDialog(false)
    toast.info('Data Cleared', {
      description: 'All uploaded data has been reset.'
    })
  }

  const clearAllData = () => {
    setShowClearDialog(true)
  }

  const parseFile = (file: File) => {
    setIsProcessing(true)
    toast.loading('Processing file...', { id: 'parse' })

    const fileExtension = file.name.split('.').pop()?.toLowerCase()

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          toast.success('File parsed successfully', { id: 'parse' })
          processData(results.data)
        },
        error: (error) => {
          console.error('Error parsing CSV:', error)
          toast.error('Failed to Parse CSV', {
            description: 'Please check the file format.',
            id: 'parse'
          })
          setIsProcessing(false)
        }
      })
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { 
            type: 'array', 
            cellDates: true,
            cellText: true,
          })
          
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
            header: 1,
            raw: false,
            defval: ''
          })
          
          const headers = jsonData[0] as string[]
          const rows = jsonData.slice(1).map((row: any) => {
            const obj: any = {}
            headers.forEach((header, index) => {
              let value = row[index] || ''
              
              if (value instanceof Date) {
                const year = value.getFullYear()
                const month = String(value.getMonth() + 1).padStart(2, '0')
                const day = String(value.getDate()).padStart(2, '0')
                value = `${year}-${month}-${day}`
              }
              
              obj[header] = value
            })
            return obj
          })
          
          toast.success('File parsed successfully', { id: 'parse' })
          processData(rows)
        } catch (error) {
          console.error('Error parsing Excel:', error)
          toast.error('Failed to Parse Excel', {
            description: 'Please check the file format.',
            id: 'parse'
          })
          setIsProcessing(false)
        }
      }
      
      reader.onerror = () => {
        toast.error('Error Reading File', {
          description: 'Please try again with a different file.',
          id: 'parse'
        })
        setIsProcessing(false)
      }
      
      reader.readAsArrayBuffer(file)
    }
  }

  const fixPhoneNumber = (phoneInput: any): string => {
    if (!phoneInput) return ''
    
    let phoneStr = phoneInput.toString().trim()
    
    console.log('🔢 Original phone input:', phoneInput)
    
    // Handle scientific notation
    if (phoneStr.includes('E') || phoneStr.includes('e')) {
      console.log('⚠️ Detected scientific notation:', phoneStr)
      
      try {
        const [mantissaPart, exponentPart] = phoneStr.toLowerCase().split('e')
        const exponent = parseInt(exponentPart)
        const mantissaDigits = mantissaPart.replace('.', '').replace('-', '')
        const decimalIndex = mantissaPart.indexOf('.')
        const decimalPlaces = decimalIndex >= 0 ? mantissaPart.length - decimalIndex - 1 : 0
        const zerosNeeded = exponent - decimalPlaces
        
        if (zerosNeeded > 0) {
          phoneStr = mantissaDigits + '0'.repeat(zerosNeeded)
        } else if (zerosNeeded < 0) {
          phoneStr = mantissaDigits.substring(0, mantissaDigits.length + zerosNeeded)
        } else {
          phoneStr = mantissaDigits
        }
        
        console.log('✅ Converted to:', phoneStr)
      } catch (e) {
        console.error('❌ Error converting scientific notation:', e)
        try {
          const num = Number(phoneInput)
          phoneStr = num.toFixed(0)
        } catch (e2) {
          console.error('❌ Fallback also failed:', e2)
        }
      }
    }
    
    // Remove all non-digit characters except +
    phoneStr = phoneStr.replace(/[^\d+]/g, '')
    
    // Handle Nigerian phone numbers specifically
    if (phoneStr.startsWith('0')) {
      // Convert 080... to +23480...
      phoneStr = '+234' + phoneStr.substring(1)
    } else if (phoneStr.startsWith('80') || phoneStr.startsWith('81') || phoneStr.startsWith('70') || phoneStr.startsWith('90')) {
      // Convert 80..., 81..., 70..., 90... to +23480..., +23481..., etc.
      phoneStr = '+234' + phoneStr
    } else if (phoneStr.startsWith('234') && !phoneStr.startsWith('+')) {
      // Convert 234... to +234...
      phoneStr = '+' + phoneStr
    } else if (!phoneStr.startsWith('+') && phoneStr.length > 0) {
      // Add + if missing and it's not empty
      phoneStr = '+' + phoneStr
    }
    
    // Remove any extra + signs
    phoneStr = phoneStr.replace(/^\++/g, '+')
    
    console.log('📱 Final phone:', phoneStr)
    
    return phoneStr
  }

  const parseBirthday = (birthdayInput: any): string => {
    if (!birthdayInput) return ''
    
    let birthdayStr = birthdayInput.toString().trim()
    
    console.log('🎂 Original birthday input:', birthdayInput)
    
    // Handle Excel serial numbers
    if (!isNaN(Number(birthdayStr)) && birthdayStr.length > 4) {
      const serialNumber = Number(birthdayStr)
      if (serialNumber > 0 && serialNumber < 100000) {
        try {
          const excelEpoch = new Date(1899, 11, 30)
          const jsDate = new Date(excelEpoch.getTime() + serialNumber * 24 * 60 * 60 * 1000)
          const year = jsDate.getFullYear()
          const month = String(jsDate.getMonth() + 1).padStart(2, '0')
          const day = String(jsDate.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        } catch (e) {
          console.error('Date conversion error:', e)
        }
      }
    }
    
    // Handle date strings in various formats
    const dateFormats = [
      // YYYY-MM-DD (already correct)
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      // DD-MM-YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      // MM-DD-YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      // DD/MM/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // MM/DD/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // YYYY/MM/DD
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
    ]
    
    for (const format of dateFormats) {
      const match = birthdayStr.match(format)
      if (match) {
        let year, month, day
        
        if (format.source.includes('^\\d{4}')) {
          // YYYY first formats
          year = match[1]
          month = match[2].padStart(2, '0')
          day = match[3].padStart(2, '0')
        } else {
          // DD/MM/YYYY or MM/DD/YYYY formats
          const firstPart = parseInt(match[1])
          const secondPart = parseInt(match[2])
          
          // Determine if it's DD-MM-YYYY or MM-DD-YYYY
          if (firstPart > 12) {
            // First part is day (DD-MM-YYYY)
            day = match[1].padStart(2, '0')
            month = match[2].padStart(2, '0')
            year = match[3]
          } else if (secondPart > 12) {
            // Second part is day (MM-DD-YYYY)
            month = match[1].padStart(2, '0')
            day = match[2].padStart(2, '0')
            year = match[3]
          } else {
            // Ambiguous case, assume MM-DD-YYYY
            month = match[1].padStart(2, '0')
            day = match[2].padStart(2, '0')
            year = match[3]
          }
        }
        
        // Validate the date
        const date = new Date(`${year}-${month}-${day}`)
        if (!isNaN(date.getTime()) && date.getFullYear().toString() === year) {
          console.log('✅ Parsed birthday:', `${year}-${month}-${day}`)
          return `${year}-${month}-${day}`
        }
      }
    }
    
    // Try parsing as Date object
    if (birthdayInput instanceof Date) {
      const year = birthdayInput.getFullYear()
      const month = String(birthdayInput.getMonth() + 1).padStart(2, '0')
      const day = String(birthdayInput.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    console.log('❌ Could not parse birthday:', birthdayStr)
    return birthdayStr
  }

  const checkForDuplicates = async (contacts: ParsedContact[]): Promise<ParsedContact[]> => {
    setIsCheckingDuplicates(true)
    
    try {
      const phones = contacts.map(c => c.phone).filter(phone => phone)
      const emails = contacts.map(c => c.email).filter(email => email)
      
      console.log('🔍 Checking duplicates for:', { phones: phones.length, emails: emails.length })
      
      if (phones.length === 0 && emails.length === 0) {
        return contacts
      }
      
      // Check in chunks to avoid URL length issues
      const CHUNK_SIZE = 50
      const allExistingContacts: any[] = []
      
      for (let i = 0; i < Math.max(phones.length, emails.length); i += CHUNK_SIZE) {
        const phoneChunk = phones.slice(i, i + CHUNK_SIZE)
        const emailChunk = emails.slice(i, i + CHUNK_SIZE)
        
        const conditions: string[] = []
        if (phoneChunk.length > 0) {
          conditions.push(`phone.in.(${phoneChunk.join(',')})`)
        }
        if (emailChunk.length > 0) {
          conditions.push(`email.in.(${emailChunk.join(',')})`)
        }
        
        if (conditions.length > 0) {
          const { data, error } = await supabase
            .from('contacts')
            .select('first_name, last_name, email, phone')
            .or(conditions.join(','))
          
          if (error) {
            console.error('Error checking duplicates:', error)
          } else if (data) {
            allExistingContacts.push(...data)
          }
        }
      }
      
      console.log('📋 Found existing contacts:', allExistingContacts.length)
      
      const filePhoneSet = new Set<string>()
      const fileEmailSet = new Set<string>()
      
      const contactsWithDuplicates = contacts.map(contact => {
        const duplicateReasons: string[] = []
        
        if (contact.phone && filePhoneSet.has(contact.phone)) {
          duplicateReasons.push('Duplicate phone in file')
        } else if (contact.phone) {
          filePhoneSet.add(contact.phone)
        }
        
        if (contact.email && fileEmailSet.has(contact.email)) {
          duplicateReasons.push('Duplicate email in file')
        } else if (contact.email) {
          fileEmailSet.add(contact.email)
        }
        
        const dbDuplicate = allExistingContacts?.find(existing => 
          (existing.phone === contact.phone && contact.phone) ||
          (existing.email === contact.email && contact.email)
        )
        
        if (dbDuplicate) {
          if (dbDuplicate.phone === contact.phone) {
            duplicateReasons.push(`Phone exists: ${dbDuplicate.first_name} ${dbDuplicate.last_name}`)
          }
          if (dbDuplicate.email === contact.email) {
            duplicateReasons.push(`Email exists: ${dbDuplicate.first_name} ${dbDuplicate.last_name}`)
          }
        }
        
        const isDuplicate = duplicateReasons.length > 0
        
        return {
          ...contact,
          isDuplicate,
          duplicateReason: isDuplicate ? duplicateReasons.join(', ') : undefined,
          skipUpload: isDuplicate
        }
      })
      
      return contactsWithDuplicates
      
    } catch (error) {
      console.error('Error in duplicate check:', error)
      return contacts
    } finally {
      setIsCheckingDuplicates(false)
    }
  }

  const processData = async (data: any[]) => {
    const parsed: ParsedContact[] = []

    data.forEach((row: any, index: number) => {
      const errors: string[] = []
      
      const firstName = row.first_name ? row.first_name.toString().trim() : ''
      if (!firstName) errors.push('First name is required')
      
      const lastName = row.last_name ? row.last_name.toString().trim() : ''
      if (!lastName) errors.push('Last name is required')
      
      if (!row.phone || row.phone.toString().trim() === '') {
        errors.push('Phone is required')
      }

      const birthdayStr = parseBirthday(row.birthday)
      
      if (!birthdayStr) {
        errors.push('Birthday is required')
      } else {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        if (!dateRegex.test(birthdayStr)) {
          errors.push('Birthday must be in YYYY-MM-DD format')
        } else {
          const testDate = new Date(birthdayStr)
          if (isNaN(testDate.getTime())) {
            errors.push('Invalid birthday date')
          }
        }
      }

      let emailStr = ''
      if (row.email) {
        emailStr = row.email.toString().trim().toLowerCase()
        
        if (emailStr && emailStr !== '') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(emailStr)) {
            errors.push('Invalid email format')
          }
        }
      }

      const phoneStr = fixPhoneNumber(row.phone)
      
      if (phoneStr && phoneStr.length < 10) {
        errors.push('Phone number too short')
      }
      if (phoneStr && phoneStr.length > 20) {
        errors.push('Phone number too long')
      }

      const notesStr = row.notes ? row.notes.toString().trim() : ''

      parsed.push({
        first_name: firstName,
        last_name: lastName,
        email: emailStr,
        phone: phoneStr,
        birthday: birthdayStr,
        notes: notesStr,
        row: index + 2,
        isValid: errors.length === 0,
        errors,
        skipUpload: false
      })
    })

    console.log('📊 Initial parsed data:', parsed.length, 'contacts')

    const contactsWithDuplicates = await checkForDuplicates(parsed)
    
    const validContacts = contactsWithDuplicates.filter(c => c.isValid)
    const duplicateContacts = contactsWithDuplicates.filter(c => c.isDuplicate && c.isValid)
    const newContacts = validContacts.filter(c => !c.isDuplicate)
    const existingContacts = validContacts.filter(c => c.isDuplicate)

    setParsedData(contactsWithDuplicates)
    setStats({
      total: contactsWithDuplicates.length,
      valid: validContacts.length,
      invalid: contactsWithDuplicates.filter(p => !p.isValid).length,
      duplicates: duplicateContacts.length,
      newContacts: newContacts.length,
      existingContacts: existingContacts.length,
      skippedByUser: 0
    })
    
    // Add toast notification
    if (newContacts.length > 0) {
      toast.success('Data Processed Successfully', {
        description: `${newContacts.length} new contacts ready to upload • ${existingContacts.length} duplicates detected`
      })
    } else if (existingContacts.length > 0) {
      toast.warning('All Contacts Are Duplicates', {
        description: `Found ${existingContacts.length} duplicate contacts. No new contacts to upload.`
      })
    } else if (contactsWithDuplicates.filter(p => !p.isValid).length > 0) {
      toast.error('No Valid Contacts Found', {
        description: 'Please check your file and fix the errors.'
      })
    }
    
    setIsProcessing(false)
  }

  const toggleDuplicateUpload = (index: number) => {
    // Get the actual contact from the filtered data
    const contact = paginatedData[index]
    if (!contact) return
    
    // Find the original index in the full parsedData array
    const originalIndex = parsedData.findIndex(c => 
      c.row === contact.row && 
      c.first_name === contact.first_name && 
      c.last_name === contact.last_name
    )
    
    if (originalIndex === -1) return
    
    // Create a new array and toggle the skipUpload status
    const newData = [...parsedData]
    newData[originalIndex] = {
      ...newData[originalIndex],
      skipUpload: !newData[originalIndex].skipUpload
    }
    
    setParsedData(newData)
    
    // Recalculate stats
    const validContacts = newData.filter(c => c.isValid)
    const skippedDuplicates = validContacts.filter(c => c.isDuplicate && c.skipUpload)
    const uploadableDuplicates = validContacts.filter(c => c.isDuplicate && !c.skipUpload)
    const newContactsCount = validContacts.filter(c => !c.isDuplicate).length
    
    setStats(prev => ({
      ...prev,
      newContacts: newContactsCount + uploadableDuplicates.length,
      skippedByUser: skippedDuplicates.length
    }))

    // Show feedback
    if (newData[originalIndex].skipUpload) {
      toast.info('Duplicate Skipped', {
        description: `${contact.first_name} ${contact.last_name} will be skipped from upload`
      })
    } else {
      toast.info('Duplicate Included', {
        description: `${contact.first_name} ${contact.last_name} will be included in upload`
      })
    }
  }

  const confirmUpload = async () => {
    const contactsToUpload = parsedData.filter(c => c.isValid && !c.skipUpload)
    
    setShowUploadDialog(false)
    setIsUploading(true)
    toast.loading(`Uploading ${contactsToUpload.length} contacts...`, { id: 'upload' })

    try {
      let successCount = 0
      let failCount = 0

      const BATCH_SIZE = 100
      for (let i = 0; i < contactsToUpload.length; i += BATCH_SIZE) {
        const batch = contactsToUpload.slice(i, i + BATCH_SIZE)
        const insertData = batch.map(contact => ({
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email || null,
          phone: contact.phone,
          birthday: contact.birthday,
          notes: contact.notes || null,
          tags: [],
          is_active: true,
          created_by: profile?.id
        }))
        
        const { data, error } = await supabase
          .from('contacts')
          .insert(insertData)
          .select()

        if (error) {
          console.error('Batch error:', error)
          failCount += batch.length
        } else {
          console.log('✅ Successfully inserted batch:', data?.length || 0)
          successCount += data?.length || 0
        }
        
        // Update progress
        toast.loading(`Uploading... ${successCount + failCount}/${contactsToUpload.length}`, { id: 'upload' })
      }

      if (successCount > 0 && failCount === 0) {
        toast.success('Upload Complete! 🎉', {
          description: `Successfully uploaded ${successCount} contact${successCount !== 1 ? 's' : ''}`,
          id: 'upload',
          duration: 5000
        })
      } else if (successCount > 0 && failCount > 0) {
        toast.warning('Upload Partially Complete', {
          description: `${successCount} successful, ${failCount} failed`,
          id: 'upload',
          duration: 5000
        })
      } else {
        toast.error('Upload Failed', {
          description: `All ${failCount} contacts failed to upload`,
          id: 'upload'
        })
      }

      setUploadResult({ success: successCount, failed: failCount })
      setUploadComplete(true)

      // Log activity
      if (successCount > 0) {
        await supabase.from('activity_logs').insert({
          user_id: profile?.id,
          action_type: 'bulk_upload',
          action_description: `Bulk uploaded ${successCount} contacts (skipped ${stats.skippedByUser + stats.existingContacts} duplicates)`,
          entity_type: 'contact'
        })
      }

    } catch (error) {
      console.error('Error uploading contacts:', error)
      toast.error('Upload Error', {
        description: 'An unexpected error occurred. Please try again.',
        id: 'upload'
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleUpload = () => {
    const contactsToUpload = parsedData.filter(c => c.isValid && !c.skipUpload)
    
    if (contactsToUpload.length === 0) {
      toast.error('No Contacts to Upload', {
        description: 'All contacts are either invalid or skipped.'
      })
      return
    }

    setShowUploadDialog(true)
  }

  const downloadTemplate = () => {
    const template = `first_name,last_name,email,phone,birthday,notes
John,Doe,john.doe@example.com,+2348012345678,1990-05-15,Friend from college
Jane,Smith,jane.smith@example.com,+2348087654321,1985-12-25,Family member`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'contacts_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
    
    toast.success('Template Downloaded', {
      description: 'Check your downloads folder for contacts_template.csv'
    })
  }

  const resetUpload = () => {
    setFile(null)
    setFileUrl('')
    resetPreviewData()
  }

  const getStatusBadge = (contact: ParsedContact) => {
    if (!contact.isValid) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Invalid</span>
    }
    if (contact.isDuplicate && contact.skipUpload) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Skipped</span>
    }
    if (contact.isDuplicate) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">Duplicate</span>
    }
    return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">Ready</span>
  }

  const getBadgeClass = (type: string) => {
    const baseClass = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
    switch (type) {
      case 'valid': return `${baseClass} bg-green-100 text-green-800`
      case 'invalid': return `${baseClass} bg-red-100 text-red-800`
      case 'duplicates': return `${baseClass} bg-orange-100 text-orange-800`
      case 'ready': return `${baseClass} bg-purple-100 text-purple-800`
      default: return `${baseClass} bg-gray-100 text-gray-800`
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Upload Contacts</h1>
          <p className="text-gray-600 mt-1">Upload via file or URL with duplicate control</p>
        </div>
        <Upload className="w-8 h-8 text-gray-400" />
      </div>

      {/* Google Sheets Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Download className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900">For Google Sheets Users</h4>
            <p className="text-blue-700 text-sm mt-1">
              For best results with Google Sheets: 
              <strong> Click "File" → "Download" → "Comma-separated values (.csv)"</strong> 
              then upload the downloaded file using the File Upload option below.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            Smart Duplicate Protection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Automatic Detection</p>
                <p className="text-sm text-gray-600">Checks phone & email against existing contacts</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Manual Control</p>
                <p className="text-sm text-gray-600">Choose which duplicates to upload anyway</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download CSV Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {uploadComplete && uploadResult && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Upload Complete! 🎉</h3>
              <p className="text-gray-600 mb-2">
                Successfully uploaded <strong>{uploadResult.success}</strong> contact{uploadResult.success !== 1 ? 's' : ''}
              </p>
              {uploadResult.failed > 0 && (
                <p className="text-red-600 mb-4">
                  <strong>{uploadResult.failed}</strong> failed
                </p>
              )}
              <div className="flex gap-3 justify-center mt-4">
                <Button onClick={() => navigate('/contacts')}>
                  View Contacts
                </Button>
                <Button variant="outline" onClick={resetUpload}>
                  Upload More
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!uploadComplete && (
        <Card>
          <CardHeader>
            <CardTitle>📤 Upload Method</CardTitle>
            <div className="flex gap-2 mt-2">
              <Button
                variant={uploadMethod === 'file' ? 'default' : 'outline'}
                onClick={() => setUploadMethod('file')}
              >
                <Upload className="w-4 h-4 mr-2" />
                File Upload
              </Button>
              <Button
                variant={uploadMethod === 'url' ? 'default' : 'outline'}
                onClick={() => setUploadMethod('url')}
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                URL Upload
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {uploadMethod === 'file' ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
                  ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                `}
              >
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className={`w-16 h-16 mx-auto mb-4 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`} />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {file ? file.name : 'Drop your file here'}
                  </h3>
                  <p className="text-gray-600 mb-4">or click to browse</p>
                  <p className="text-sm text-gray-500">Supports: CSV, XLS, XLSX (Max 10MB)</p>
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter File URL
                  </label>
                  <Input
                    type="url"
                    placeholder="https://example.com/contacts.csv"
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    className="w-full"
                  />
                  <div className="mt-2 text-xs text-gray-600 space-y-1">
                    <p className="font-medium">✅ Supported URLs:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                      <li>Direct links to CSV/Excel files</li>
                      <li>Google Drive files (CSV/Excel with public access)</li>
                    </ul>
                    <p className="mt-2 text-orange-600 font-medium">
                      ⚠️ For Google Sheets: Use "File → Download → CSV" and upload the file directly
                    </p>
                    <p className="text-gray-500">
                      Direct Google Sheets URL access is unreliable due to security restrictions.
                    </p>
                  </div>
                </div>
                <Button onClick={handleUrlUpload} disabled={isLoadingUrl || !fileUrl.trim()}>
                  {isLoadingUrl ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading from URL...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-4 h-4 mr-2" />
                      Load from URL
                    </>
                  )}
                </Button>
              </div>
            )}

            {isProcessing && (
              <div className="mt-6 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-gray-600">
                  {isCheckingDuplicates ? 'Checking for duplicates...' : 'Processing file...'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {parsedData.length > 0 && !uploadComplete && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Valid</p>
                  <p className="text-2xl font-bold text-green-600">{stats.valid}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Invalid</p>
                  <p className="text-2xl font-bold text-red-600">{stats.invalid}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Duplicates</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.existingContacts}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">To Upload</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.newContacts}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Skipped</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.skippedByUser}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contact Preview</CardTitle>
                  <CardDescription>
                    Review and manage your contacts before uploading
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={clearAllData}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                  <Button 
                    onClick={handleUpload}
                    disabled={stats.newContacts === 0 || isUploading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload {stats.newContacts}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <Input
                      placeholder="Search contacts by name, email, or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Filter className="w-4 h-4 text-gray-500 mt-2" />
                  <span className="text-sm text-gray-600 mt-2">Filter:</span>
                </div>
              </div>

              {/* Custom Tabs for different views */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: 'all', label: 'All', count: parsedData.length },
                    { id: 'valid', label: 'Valid', count: stats.valid },
                    { id: 'invalid', label: 'Invalid', count: stats.invalid },
                    { id: 'duplicates', label: 'Duplicates', count: stats.existingContacts },
                    { id: 'ready', label: 'Ready', count: stats.newContacts },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setViewMode(tab.id as ViewMode)}
                      className={`
                        whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                        ${viewMode === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }
                      `}
                    >
                      {tab.label}
                      <span className={getBadgeClass(tab.id)}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Contact Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Row</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Phone</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Birthday</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          No contacts found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((contact, index) => (
                        <tr key={index} className={
                          !contact.isValid ? 'bg-red-50' : 
                          contact.isDuplicate && contact.skipUpload ? 'bg-gray-100' :
                          contact.isDuplicate ? 'bg-orange-50' : 
                          'bg-green-50'
                        }>
                          <td className="px-4 py-3 text-gray-600">{contact.row}</td>
                          <td className="px-4 py-3">
                            {getStatusBadge(contact)}
                          </td>
                          <td className="px-4 py-3">
                            {contact.isDuplicate && contact.isValid && (
                              <Button
                                size="sm"
                                variant={contact.skipUpload ? "outline" : "default"}
                                onClick={() => toggleDuplicateUpload(index)}
                                className={contact.skipUpload ? "" : "bg-orange-600 hover:bg-orange-700"}
                              >
                                {contact.skipUpload ? "Include" : "Skip"}
                              </Button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {contact.first_name} {contact.last_name}
                          </td>
                          <td className="px-4 py-3 text-gray-900">{contact.email || '-'}</td>
                          <td className="px-4 py-3 text-gray-900">{contact.phone}</td>
                          <td className="px-4 py-3 text-gray-900">{contact.birthday}</td>
                          <td className="px-4 py-3">
                            {!contact.isValid ? (
                              <ul className="text-xs text-red-600 list-disc list-inside">
                                {contact.errors.map((error, i) => (
                                  <li key={i}>{error}</li>
                                ))}
                              </ul>
                            ) : contact.isDuplicate ? (
                              <div className="text-xs">
                                <div className={`font-medium ${contact.skipUpload ? 'text-gray-600' : 'text-orange-600'}`}>
                                  {contact.skipUpload ? '⊗ Will Skip' : '⚠ Duplicate'}
                                </div>
                                <div className="text-gray-600">{contact.duplicateReason}</div>
                              </div>
                            ) : (
                              <span className="text-green-600 text-xs font-medium">✓ Ready to upload</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} contacts
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }
                        
                        return (
                          <Button
                            key={i}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-10"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Upload Confirmation Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Confirm Upload
            </DialogTitle>
            <DialogDescription>
              You are about to upload <strong>{parsedData.filter(c => c.isValid && !c.skipUpload).length}</strong> contacts to the database.
              {stats.skippedByUser > 0 && (
                <span className="block mt-2 text-orange-600">
                  {stats.skippedByUser} duplicate{stats.skippedByUser !== 1 ? 's' : ''} will be skipped.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">New contacts:</span>
                <span className="font-semibold text-green-600">{stats.newContacts}</span>
              </div>
              {stats.skippedByUser > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Skipped duplicates:</span>
                  <span className="font-semibold text-orange-600">{stats.skippedByUser}</span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="text-gray-900 font-medium">Total to upload:</span>
                <span className="font-bold text-blue-600">{parsedData.filter(c => c.isValid && !c.skipUpload).length}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmUpload} className="bg-green-600 hover:bg-green-700">
              <Upload className="w-4 h-4 mr-2" />
              Upload Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Clear All Data
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to clear all uploaded data? This will reset everything and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <strong>This will remove:</strong>
              </p>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
                <li>{stats.total} parsed contacts</li>
                <li>All validation results</li>
                <li>Upload preview data</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmClearAll} variant="destructive">
              <RefreshCw className="w-4 h-4 mr-2" />
              Clear All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}