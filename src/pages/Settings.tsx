import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/context/AuthContext"
import { Settings as SettingsIcon, Mail, MessageSquare, CheckCircle, XCircle, Loader2, Eye, EyeOff, Clock, Globe } from "lucide-react"
import { useNavigate } from "react-router-dom"

interface Setting {
  setting_key: string
  setting_value: string
  description: string
}

export default function Settings() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState<'sms' | 'email' | null>(null)
  const [testResult, setTestResult] = useState<{ type: 'sms' | 'email', success: boolean, message: string } | null>(null)
  
  const [showTermiiKey, setShowTermiiKey] = useState(false)
  const [showResendKey, setShowResendKey] = useState(false)

  const [settings, setSettings] = useState({
    termii_api_key: '',
    termii_sender_id: '',
    resend_api_key: '',
    resend_from_email: '',
    resend_from_name: '',
    system_timezone: 'UTC',
    daily_cron_time: '09:00',
    enable_sms: 'true',
    enable_email: 'true',
    system_name: 'Birthday Automation',
    max_retries: '3'
  })

  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const canEdit = ['developer', 'admin'].includes(profile?.role || '')

  useEffect(() => {
    if (!canEdit) {
      navigate('/dashboard')
      return
    }
    fetchSettings()
  }, [canEdit, navigate])

  const fetchSettings = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')

      if (error) throw error

      const settingsMap: any = {}
      data?.forEach((setting: Setting) => {
        settingsMap[setting.setting_key] = setting.setting_value || ''
      })

      setSettings(prev => ({ ...prev, ...settingsMap }))
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const updates = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString()
      }))

      for (const update of updates) {
        const { error } = await supabase
          .from('system_settings')
          .update({ setting_value: update.setting_value, updated_at: update.updated_at })
          .eq('setting_key', update.setting_key)

        if (error) throw error
      }

      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error: any) {
      console.error('Error saving settings:', error)
      setSaveMessage({ type: 'error', text: 'Failed to save settings: ' + error.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestSMS = async () => {
    setIsTesting('sms')
    setTestResult(null)

    try {
      if (!settings.termii_api_key || !settings.termii_sender_id) {
        setTestResult({
          type: 'sms',
          success: false,
          message: 'Please configure Termii API Key and Sender ID first'
        })
        setIsTesting(null)
        return
      }

      setTestResult({
        type: 'sms',
        success: true,
        message: 'SMS configuration looks good! (Full test requires phone number)'
      })
    } catch (error: any) {
      setTestResult({
        type: 'sms',
        success: false,
        message: 'SMS test failed: ' + error.message
      })
    } finally {
      setIsTesting(null)
    }
  }

  const handleTestEmail = async () => {
    setIsTesting('email')
    setTestResult(null)

    try {
      if (!settings.resend_api_key || !settings.resend_from_email) {
        setTestResult({
          type: 'email',
          success: false,
          message: 'Please configure Resend API Key and From Email first'
        })
        setIsTesting(null)
        return
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(settings.resend_from_email)) {
        setTestResult({
          type: 'email',
          success: false,
          message: 'Invalid email format'
        })
        setIsTesting(null)
        return
      }

      setTestResult({
        type: 'email',
        success: true,
        message: 'Email configuration looks good! (Full test requires recipient email)'
      })
    } catch (error: any) {
      setTestResult({
        type: 'email',
        success: false,
        message: 'Email test failed: ' + error.message
      })
    } finally {
      setIsTesting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  if (!canEdit) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-1">Configure messaging providers and system preferences</p>
        </div>
        <SettingsIcon className="w-8 h-8 text-gray-400" />
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`p-4 rounded-lg border ${
          saveMessage.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {saveMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{saveMessage.text}</span>
          </div>
        </div>
      )}

      {/* General Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <SettingsIcon className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure system preferences and scheduling</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="system_name">System Name</Label>
              <Input
                id="system_name"
                value={settings.system_name}
                onChange={(e) => setSettings({ ...settings, system_name: e.target.value })}
                placeholder="Birthday Automation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="system_timezone">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Timezone
                </div>
              </Label>
              <select
                id="system_timezone"
                value={settings.system_timezone}
                onChange={(e) => setSettings({ ...settings, system_timezone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="UTC">UTC (Universal)</option>
                <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              </select>
              <p className="text-sm text-gray-500">
                System timezone for scheduling birthday checks
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daily_cron_time">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Daily Check Time
                </div>
              </Label>
              <Input
                id="daily_cron_time"
                type="time"
                value={settings.daily_cron_time}
                onChange={(e) => setSettings({ ...settings, daily_cron_time: e.target.value })}
              />
              <p className="text-sm text-gray-500">
                Time to check for birthdays daily (24-hour format)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_retries">Max Retry Attempts</Label>
              <Input
                id="max_retries"
                type="number"
                min="0"
                max="10"
                value={settings.max_retries}
                onChange={(e) => setSettings({ ...settings, max_retries: e.target.value })}
              />
              <p className="text-sm text-gray-500">
                Maximum retry attempts for failed messages
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="space-y-3">
              <Label>Message Types</Label>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enable_sms === 'true'}
                    onChange={(e) => setSettings({ ...settings, enable_sms: e.target.checked ? 'true' : 'false' })}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                    <span>Enable SMS Messages</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enable_email === 'true'}
                    onChange={(e) => setSettings({ ...settings, enable_email: e.target.checked ? 'true' : 'false' })}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span>Enable Email Messages</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Termii SMS Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <CardTitle>Termii SMS Configuration</CardTitle>
              <CardDescription>Configure Termii for sending SMS birthday messages</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="termii_api_key">Termii API Key *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="termii_api_key"
                  type={showTermiiKey ? "text" : "password"}
                  value={settings.termii_api_key}
                  onChange={(e) => setSettings({ ...settings, termii_api_key: e.target.value })}
                  placeholder="Enter your Termii API Key"
                />
                <button
                  type="button"
                  onClick={() => setShowTermiiKey(!showTermiiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showTermiiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Get your API key from <a href="https://termii.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Termii Dashboard</a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="termii_sender_id">Sender ID *</Label>
            <Input
              id="termii_sender_id"
              value={settings.termii_sender_id}
              onChange={(e) => setSettings({ ...settings, termii_sender_id: e.target.value })}
              placeholder="e.g., BIRTHDAY"
              maxLength={11}
            />
            <p className="text-sm text-gray-500">
              Your approved sender ID (max 11 characters)
            </p>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleTestSMS}
              disabled={isTesting === 'sms' || !settings.termii_api_key}
            >
              {isTesting === 'sms' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Test SMS Config
                </>
              )}
            </Button>

            {testResult?.type === 'sms' && (
              <div className={`flex items-center gap-2 text-sm ${
                testResult.success ? 'text-green-600' : 'text-red-600'
              }`}>
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resend Email Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <CardTitle>Resend Email Configuration</CardTitle>
              <CardDescription>Configure Resend for sending email birthday messages</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resend_api_key">Resend API Key *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="resend_api_key"
                  type={showResendKey ? "text" : "password"}
                  value={settings.resend_api_key}
                  onChange={(e) => setSettings({ ...settings, resend_api_key: e.target.value })}
                  placeholder="Enter your Resend API Key"
                />
                <button
                  type="button"
                  onClick={() => setShowResendKey(!showResendKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showResendKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Get your API key from <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Resend Dashboard</a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resend_from_email">From Email *</Label>
            <Input
              id="resend_from_email"
              type="email"
              value={settings.resend_from_email}
              onChange={(e) => setSettings({ ...settings, resend_from_email: e.target.value })}
              placeholder="birthday@yourdomain.com"
            />
            <p className="text-sm text-gray-500">
              Email address to send birthday messages from (must be verified in Resend)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resend_from_name">From Name</Label>
            <Input
              id="resend_from_name"
              value={settings.resend_from_name}
              onChange={(e) => setSettings({ ...settings, resend_from_name: e.target.value })}
              placeholder="Birthday Bot"
            />
            <p className="text-sm text-gray-500">
              Display name for the sender (optional)
            </p>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleTestEmail}
              disabled={isTesting === 'email' || !settings.resend_api_key}
            >
              {isTesting === 'email' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Test Email Config
                </>
              )}
            </Button>

            {testResult?.type === 'email' && (
              <div className={`flex items-center gap-2 text-sm ${
                testResult.success ? 'text-green-600' : 'text-red-600'
              }`}>
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => navigate('/dashboard')}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Save All Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}