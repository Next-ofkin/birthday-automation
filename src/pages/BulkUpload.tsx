// ============================================================================
// BULK UPLOAD CONTACTS COMPONENT
// ============================================================================
// This component allows users to bulk upload contacts via CSV/Excel files
// or URLs with intelligent validation, duplicate detection, and preview functionality

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
  Search,
  Table,
  ArrowLeft
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

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Represents a single contact after parsing from file
 * Includes validation status and duplicate detection info
 */
interface ParsedContact {
  first_name: string
  last_name: string
  email: string
  phone: string
  birthday: string
  notes?: string
  row: number              // Original row number in file (for error reporting)
  isValid: boolean         // Whether it passes validation rules
  errors: string[]         // List of validation error messages
  isDuplicate?: boolean    // Whether it exists in DB or appears multiple times in file
  duplicateReason?: string // Human-readable explanation of why it's a duplicate
  skipUpload?: boolean     // User can toggle to skip/include duplicates
}

/**
 * Statistics displayed in the UI cards
 */
interface UploadStats {
  total: number            // Total rows parsed
  valid: number            // Rows passing validation
  invalid: number          // Rows failing validation
  duplicates: number       // Duplicates found (legacy, use existingContacts)
  newContacts: number      // Valid contacts ready to upload
  existingContacts: number // Valid contacts that are duplicates
  skippedByUser: number    // Duplicates user chose to skip
}

/**
 * Filter modes for the preview table tabs
 */
type ViewMode = 'all' | 'valid' | 'invalid' | 'duplicates' | 'ready'

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BulkUpload() {
  // -------------------------------------------------------------------------
  // HOOKS & CONTEXT
  // -------------------------------------------------------------------------

  const { profile } = useAuth()          // Get current user profile from auth context
  const navigate = useNavigate()          // React Router navigation hook

  // -------------------------------------------------------------------------
  // STATE MANAGEMENT
  // -------------------------------------------------------------------------

  // Upload method: 'file' for drag-drop/file picker, 'url' for remote file loading
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file')
  const [fileUrl, setFileUrl] = useState('')           // URL input value
  const [isLoadingUrl, setIsLoadingUrl] = useState(false) // Loading state for URL fetch

  // File handling state
  const [file, setFile] = useState<File | null>(null)  // Selected file object
  const [isDragging, setIsDragging] = useState(false)   // Drag active state for visual feedback
  const [isProcessing, setIsProcessing] = useState(false) // Parsing file state
  const [isUploading, setIsUploading] = useState(false)   // Uploading to DB state

  // Data and results
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

  // UI state
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)  // Confirm upload modal
  const [showClearDialog, setShowClearDialog] = useState(false)    // Confirm clear modal
  const [viewMode, setViewMode] = useState<ViewMode>('all')        // Current filter tab
  const [searchTerm, setSearchTerm] = useState('')                 // Search input value

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20  // Number of contacts shown per page

  // -------------------------------------------------------------------------
  // PERMISSION CHECK
  // -------------------------------------------------------------------------

  // Only allow specific user roles to access bulk upload functionality
  const canUpload = ['developer', 'admin', 'customer_service'].includes(profile?.role || '')

  // Redirect unauthorized users to dashboard
  if (!canUpload) {
    navigate('/dashboard')
    return null
  }

  // -------------------------------------------------------------------------
  // FILTERING & PAGINATION LOGIC
  // -------------------------------------------------------------------------

  /**
   * Filter contacts based on search term and selected view mode
   * Search matches: first name, last name, email (case-insensitive), phone
   */
  const filteredData = parsedData.filter(contact => {
    // Search filter - check if search term matches any field
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = !searchTerm ||
      contact.first_name.toLowerCase().includes(searchLower) ||
      contact.last_name.toLowerCase().includes(searchLower) ||
      contact.email.toLowerCase().includes(searchLower) ||
      contact.phone.includes(searchTerm)

    if (!matchesSearch) return false

    // View mode filter - show only contacts matching selected tab
    switch (viewMode) {
      case 'valid':    // Valid contacts that are NOT duplicates
        return contact.isValid && !contact.isDuplicate
      case 'invalid':  // Contacts failing validation
        return !contact.isValid
      case 'duplicates': // Contacts marked as duplicates (but may be valid)
        return contact.isDuplicate
      case 'ready':    // Contacts ready to upload (valid and not skipped)
        return contact.isValid && !contact.skipUpload
      case 'all':      // Show everything
      default:
        return true
    }
  })

  // Calculate total pages for pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)

  // Slice data for current page view
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Reset to first page when filters change to avoid empty pages
  useEffect(() => {
    setCurrentPage(1)
  }, [viewMode, searchTerm])

  // -------------------------------------------------------------------------
  // DRAG & DROP HANDLERS
  // -------------------------------------------------------------------------

  /** Handle drag enter - prevent default and show visual feedback */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  /** Handle drag leave - remove visual feedback */
  const handleDragLeave = () => {
    setIsDragging(false)
  }

  /** Handle file drop - process the dropped file */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  /** Handle file selection via input element */
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  // -------------------------------------------------------------------------
  // FILE VALIDATION & SELECTION
  // -------------------------------------------------------------------------

  /**
   * Validate and process selected file
   * Checks: file type (CSV, XLS, XLSX), file size (max 10MB)
   */
  const handleFileSelect = (selectedFile: File) => {
    // Define valid MIME types and extensions
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase()

    // Validate file type
    if (!validTypes.includes(selectedFile.type) && !['csv', 'xls', 'xlsx'].includes(fileExtension || '')) {
      toast.error('Invalid File Type', {
        description: 'Please upload a CSV or Excel file'
      })
      return
    }

    // Validate file size (10MB maximum)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error('File Too Large', {
        description: 'Maximum file size is 10MB. Please upload a smaller file.'
      })
      return
    }

    // Success feedback
    toast.success('File Selected', {
      description: `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(0)} KB)`
    })

    // Set file and start parsing
    setFile(selectedFile)
    resetPreviewData()
    parseFile(selectedFile)
  }

  // -------------------------------------------------------------------------
  // URL UPLOAD HANDLERS
  // -------------------------------------------------------------------------

  /** Fallback handler when Google Sheets direct access fails */
  const handleGoogleSheetsAlternative = () => {
    console.log('🔄 Using alternative Google Sheets method')

    toast.info('Google Sheets Direct Access Unavailable', {
      description: 'For best results, download your sheet as CSV and upload it directly.',
      duration: 5000,
    })

    // Switch to file upload mode as fallback
    setUploadMethod('file')
  }

  /**
   * Fetch and process file from URL
   * Supports: Direct file links, Google Sheets (converted to CSV export), Google Drive
   */
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

      // Convert Google Sheets URL to CSV export URL format
      if (fetchUrl.includes('docs.google.com/spreadsheets')) {
        console.log('📊 Detected Google Sheets URL')

        const sheetIdMatch = fetchUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)
        if (sheetIdMatch) {
          const sheetId = sheetIdMatch[1]
          const gidMatch = fetchUrl.match(/[#&]gid=([0-9]+)/)
          const gid = gidMatch ? gidMatch[1] : '0'

          // Convert to Google Sheets CSV export URL
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
      // Convert Google Drive shareable link to direct download link
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

      // Fetch the file with CORS headers
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

      // Check if we got HTML instead of CSV (common Google Sheets error)
      if (blob.type.includes('html') || blob.size < 100) {
        console.log('⚠️ Received HTML instead of CSV, trying alternative method...')
        toast.dismiss('url-load')
        handleGoogleSheetsAlternative()
        return
      }

      // Determine file name and type
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

      // Create File object from blob
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

      // Determine appropriate error message
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

  // -------------------------------------------------------------------------
  // DATA RESET FUNCTIONS
  // -------------------------------------------------------------------------

  /** Reset all preview data and statistics */
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

  /** Confirm and execute clear all data */
  const confirmClearAll = () => {
    setFile(null)
    setFileUrl('')
    resetPreviewData()
    setShowClearDialog(false)
    toast.info('Data Cleared', {
      description: 'All uploaded data has been reset.'
    })
  }

  /** Show clear confirmation dialog */
  const clearAllData = () => {
    setShowClearDialog(true)
  }

  // -------------------------------------------------------------------------
  // FILE PARSING
  // -------------------------------------------------------------------------

  /**
   * Parse CSV or Excel file into JSON data
   * Uses PapaParse for CSV, XLSX library for Excel
   */
  const parseFile = (file: File) => {
    setIsProcessing(true)
    toast.loading('Processing file...', { id: 'parse' })

    const fileExtension = file.name.split('.').pop()?.toLowerCase()

    // Parse CSV using PapaParse
    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,           // Use first row as headers
        skipEmptyLines: true,   // Skip empty rows
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
    }
    // Parse Excel using XLSX library
    else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, {
            type: 'array',
            cellDates: true,    // Parse Excel dates as JS Date objects
            cellText: true,     // Get formatted text values
          })

          // Get first sheet only
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]

          // Convert to array of arrays (header row + data rows)
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
            header: 1,
            raw: false,
            defval: ''
          })

          // Convert array format to object format using headers
          const headers = jsonData[0] as string[]
          const rows = jsonData.slice(1).map((row: any) => {
            const obj: any = {}
            headers.forEach((header, index) => {
              let value = row[index] || ''

              // Convert Date objects to YYYY-MM-DD string format
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

  // -------------------------------------------------------------------------
  // DATA NORMALIZATION HELPERS
  // -------------------------------------------------------------------------

  /**
   * Normalize phone numbers to international format (+234...)
   * Handles: scientific notation, local Nigerian formats, missing country codes
   */
  const fixPhoneNumber = (phoneInput: any): string => {
    if (!phoneInput) return ''

    let phoneStr = phoneInput.toString().trim()

    console.log('🔢 Original phone input:', phoneInput)

    // Handle Excel scientific notation (e.g., 8.012345678E+9)
    if (phoneStr.includes('E') || phoneStr.includes('e')) {
      console.log('⚠️ Detected scientific notation:', phoneStr)

      try {
        const [mantissaPart, exponentPart] = phoneStr.toLowerCase().split('e')
        const exponent = parseInt(exponentPart)
        const mantissaDigits = mantissaPart.replace('.', '').replace('-', '')
        const decimalIndex = mantissaPart.indexOf('.')
        const decimalPlaces = decimalIndex >= 0 ? mantissaPart.length - decimalIndex - 1 : 0
        const zerosNeeded = exponent - decimalPlaces

        // Reconstruct number string
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
        // Fallback: try parsing as number
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

    // Handle Nigerian phone number formats
    if (phoneStr.startsWith('0')) {
      // Convert 080... to +23480...
      phoneStr = '+234' + phoneStr.substring(1)
    } else if (phoneStr.startsWith('80') || phoneStr.startsWith('81') || phoneStr.startsWith('70') || phoneStr.startsWith('90')) {
      // Convert 80..., 81..., 70..., 90... to +234...
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

  /**
   * Parse birthday from various formats to YYYY-MM-DD
   * Handles: Excel serial numbers, multiple date formats, Date objects
   */
  const parseBirthday = (birthdayInput: any): string => {
    if (!birthdayInput) return ''

    let birthdayStr = birthdayInput.toString().trim()

    console.log('🎂 Original birthday input:', birthdayInput)

    // Handle Excel date serial numbers (days since 1899-12-30)
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

    // Handle date strings in various formats using regex patterns
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

          // Determine if it's DD-MM-YYYY or MM-DD-YYYY based on values > 12
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

        // Validate the date is real
        const date = new Date(`${year}-${month}-${day}`)
        if (!isNaN(date.getTime()) && date.getFullYear().toString() === year) {
          console.log('✅ Parsed birthday:', `${year}-${month}-${day}`)
          return `${year}-${month}-${day}`
        }
      }
    }

    // Try parsing as Date object directly
    if (birthdayInput instanceof Date) {
      const year = birthdayInput.getFullYear()
      const month = String(birthdayInput.getMonth() + 1).padStart(2, '0')
      const day = String(birthdayInput.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    console.log('❌ Could not parse birthday:', birthdayStr)
    return birthdayStr
  }

  // -------------------------------------------------------------------------
  // DUPLICATE DETECTION
  // -------------------------------------------------------------------------

  /**
   * Check contacts against database for duplicates
   * Also detects duplicates within the uploaded file itself
   * Processes in chunks to avoid URL length limits
   */
  const checkForDuplicates = async (contacts: ParsedContact[]): Promise<ParsedContact[]> => {
    setIsCheckingDuplicates(true)

    try {
      // Extract all phones and emails for database query
      const phones = contacts.map(c => c.phone).filter(phone => phone)
      const emails = contacts.map(c => c.email).filter(email => email)

      console.log('🔍 Checking duplicates for:', { phones: phones.length, emails: emails.length })

      if (phones.length === 0 && emails.length === 0) {
        return contacts
      }

      // Query database in chunks to avoid URL length issues
      const CHUNK_SIZE = 50
      const allExistingContacts: any[] = []

      for (let i = 0; i < Math.max(phones.length, emails.length); i += CHUNK_SIZE) {
        const phoneChunk = phones.slice(i, i + CHUNK_SIZE)
        const emailChunk = emails.slice(i, i + CHUNK_SIZE)

        // Build Supabase query conditions
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

      // Track seen phones/emails within the file to detect internal duplicates
      const filePhoneSet = new Set<string>()
      const fileEmailSet = new Set<string>()

      // Check each contact for duplicates
      const contactsWithDuplicates = contacts.map(contact => {
        const duplicateReasons: string[] = []

        // Check for duplicates within the file itself
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

        // Check against database records
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
          skipUpload: isDuplicate  // Auto-skip duplicates by default
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

  // -------------------------------------------------------------------------
  // DATA PROCESSING
  // -------------------------------------------------------------------------

  /**
   * Main data processing pipeline
   * Validates fields, normalizes data, checks duplicates, updates statistics
   */
  const processData = async (data: any[]) => {
    const parsed: ParsedContact[] = []

    // Process each row from the file
    data.forEach((row: any, index: number) => {
      const errors: string[] = []

      // Validate and extract first name
      const firstName = row.first_name ? row.first_name.toString().trim() : ''
      if (!firstName) errors.push('First name is required')

      // Validate and extract last name
      const lastName = row.last_name ? row.last_name.toString().trim() : ''
      if (!lastName) errors.push('Last name is required')

      // Validate phone presence
      if (!row.phone || row.phone.toString().trim() === '') {
        errors.push('Phone is required')
      }

      // Parse and validate birthday
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

      // Validate email format if provided
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

      // Normalize phone number
      const phoneStr = fixPhoneNumber(row.phone)

      // Validate phone length
      if (phoneStr && phoneStr.length < 10) {
        errors.push('Phone number too short')
      }
      if (phoneStr && phoneStr.length > 20) {
        errors.push('Phone number too long')
      }

      // Extract optional notes
      const notesStr = row.notes ? row.notes.toString().trim() : ''

      // Create contact object
      parsed.push({
        first_name: firstName,
        last_name: lastName,
        email: emailStr,
        phone: phoneStr,
        birthday: birthdayStr,
        notes: notesStr,
        row: index + 2,  // +2 because row 1 is header, array is 0-indexed
        isValid: errors.length === 0,
        errors,
        skipUpload: false
      })
    })

    console.log('📊 Initial parsed data:', parsed.length, 'contacts')

    // Check for duplicates in database
    const contactsWithDuplicates = await checkForDuplicates(parsed)

    // Calculate statistics
    const validContacts = contactsWithDuplicates.filter(c => c.isValid)
    const duplicateContacts = contactsWithDuplicates.filter(c => c.isDuplicate && c.isValid)
    const newContacts = validContacts.filter(c => !c.isDuplicate)
    const existingContacts = validContacts.filter(c => c.isDuplicate)

    // Update state with processed data
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

    // Show appropriate toast notification based on results
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

  // -------------------------------------------------------------------------
  // USER ACTIONS
  // -------------------------------------------------------------------------

  /**
   * Toggle whether to upload a specific duplicate contact
   * Updates both the contact state and recalculates statistics
   */
  const toggleDuplicateUpload = (index: number) => {
    // Get the contact from the current paginated view
    const contact = paginatedData[index]
    if (!contact) return

    // Find the original index in the full parsedData array
    const originalIndex = parsedData.findIndex(c =>
      c.row === contact.row &&
      c.first_name === contact.first_name &&
      c.last_name === contact.last_name
    )

    if (originalIndex === -1) return

    // Toggle the skipUpload status
    const newData = [...parsedData]
    newData[originalIndex] = {
      ...newData[originalIndex],
      skipUpload: !newData[originalIndex].skipUpload
    }

    setParsedData(newData)

    // Recalculate statistics
    const validContacts = newData.filter(c => c.isValid)
    const skippedDuplicates = validContacts.filter(c => c.isDuplicate && c.skipUpload)
    const uploadableDuplicates = validContacts.filter(c => c.isDuplicate && !c.skipUpload)
    const newContactsCount = validContacts.filter(c => !c.isDuplicate).length

    setStats(prev => ({
      ...prev,
      newContacts: newContactsCount + uploadableDuplicates.length,
      skippedByUser: skippedDuplicates.length
    }))

    // Show feedback toast
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

  /**
   * Execute the actual upload to Supabase database
   * Processes in batches of 100 for performance
   */
  const confirmUpload = async () => {
    const contactsToUpload = parsedData.filter(c => c.isValid && !c.skipUpload)

    setShowUploadDialog(false)
    setIsUploading(true)
    toast.loading(`Uploading ${contactsToUpload.length} contacts...`, { id: 'upload' })

    try {
      let successCount = 0
      let failCount = 0

      // Upload in batches to avoid request size limits
      const BATCH_SIZE = 100
      for (let i = 0; i < contactsToUpload.length; i += BATCH_SIZE) {
        const batch = contactsToUpload.slice(i, i + BATCH_SIZE)

        // Map to database schema
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

        // Update progress toast
        toast.loading(`Uploading... ${successCount + failCount}/${contactsToUpload.length}`, { id: 'upload' })
      }

      // Show final result toast
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

      // Log activity for audit trail
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

  /**
   * Open upload confirmation dialog
   * Validates that there are contacts to upload first
   */
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

  /**
   * Download CSV template file for users to fill out
   */
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

  /**
   * Reset the entire upload process to start fresh
   */
  const resetUpload = () => {
    setFile(null)
    setFileUrl('')
    resetPreviewData()
  }

  // -------------------------------------------------------------------------
  // UI HELPER FUNCTIONS
  // -------------------------------------------------------------------------

  /**
   * Get status badge component for a contact row
   */
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

  /**
   * Get CSS classes for filter tab badges
   */
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

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Upload Contacts</h1>
          <p className="text-gray-600 mt-1">Upload via file or URL with duplicate control</p>
        </div>
        <Upload className="w-8 h-8 text-gray-400" />
      </div>

      {/* Google Sheets Instructions - Helpful tip for users */}
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

      {/* Smart Duplicate Protection Info Card */}
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

      {/* Upload Complete Success Card */}
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

      {/* Main Upload Interface - File or URL selection */}
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

            {/* Google Sheets Live Sync Button */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => window.open('https://docs.google.com/spreadsheets/d/18fzdAYtd7kFUIafEbX-ozzNs7a9eLmcY4OMImklWS1Q/edit?gid=0#gid=0', '_blank')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <Table className="w-4 h-4" />
                <span className="font-medium">Open Google Sheet (Live Sync)</span>
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {uploadMethod === 'file' ? (
              // Drag and Drop Zone
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
              // URL Input Section
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

            {/* Processing Indicator */}
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

      {/* Preview Section - Statistics Cards */}
      {parsedData.length > 0 && !uploadComplete && (
        <>
          {/* Statistics Grid */}
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

          {/* Contact Preview Table Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contact Preview</CardTitle>
                  <CardDescription>
                    Review and manage your contacts before uploading
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">


                  <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                  </button>
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
              {/* Search and Filter Controls */}
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

              {/* Filter Tabs */}
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

              {/* Contacts Table */}
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
                        <tr
                          key={index}
                          className={
                            !contact.isValid ? 'bg-red-50' :
                              contact.isDuplicate && contact.skipUpload ? 'bg-gray-100' :
                                contact.isDuplicate ? 'bg-orange-50' :
                                  'bg-green-50'
                          }
                        >
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
                              // Show validation errors
                              <ul className="text-xs text-red-600 list-disc list-inside">
                                {contact.errors.map((error, i) => (
                                  <li key={i}>{error}</li>
                                ))}
                              </ul>
                            ) : contact.isDuplicate ? (
                              // Show duplicate information
                              <div className="text-xs">
                                <div className={`font-medium ${contact.skipUpload ? 'text-gray-600' : 'text-orange-600'}`}>
                                  {contact.skipUpload ? '⊗ Will Skip' : '⚠ Duplicate'}
                                </div>
                                <div className="text-gray-600">{contact.duplicateReason}</div>
                              </div>
                            ) : (
                              // Ready to upload
                              <span className="text-green-600 text-xs font-medium">✓ Ready to upload</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
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

                    {/* Page Number Buttons */}
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