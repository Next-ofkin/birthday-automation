import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

export default function DebugRLS() {
  const [results, setResults] = useState<string[]>([])

  const debugAuthUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      setResults(prev => [...prev, `❌ Auth error: ${error.message}`])
    } else if (user) {
      setResults(prev => [...prev, `✅ Logged in as: ${user.email}`])
      setResults(prev => [...prev, `🆔 User ID: ${user.id}`])
    } else {
      setResults(prev => [...prev, `❌ No user logged in`])
    }
  }

  const debugProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setResults(prev => [...prev, `❌ Not logged in`])
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      setResults(prev => [...prev, `❌ Profile error: ${error.message}`])
    } else if (data) {
      setResults(prev => [...prev, `✅ Profile found:`])
      setResults(prev => [...prev, `   Role: ${data.role}`])
      setResults(prev => [...prev, `   Email: ${data.email}`])
      setResults(prev => [...prev, `   ID matches: ${data.id === user.id}`])
    }
  }

  const testRawSQL = async () => {
    // Try using RPC to execute the same logic as the policy
    const { data, error } = await supabase.rpc('get_user_role')
    
    if (error) {
      setResults(prev => [...prev, `❌ RPC error: ${error.message}`])
      setResults(prev => [...prev, `   (This is expected - function doesn't exist yet)`])
    } else {
      setResults(prev => [...prev, `✅ Your role via RPC: ${data}`])
    }
  }

  const testPolicyCondition = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Manually test what the policy checks
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (error) {
      setResults(prev => [...prev, `❌ Can't fetch role: ${error.message}`])
    } else {
      const isPrivileged = ['developer', 'admin', 'customer_service'].includes(data.role)
      setResults(prev => [...prev, `🔍 Role: ${data.role}`])
      setResults(prev => [...prev, `🔍 Is privileged: ${isPrivileged}`])
      setResults(prev => [...prev, `🔍 Should allow UPDATE/DELETE: ${isPrivileged ? 'YES' : 'NO'}`])
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 to-orange-600 p-4">
      <div className="max-w-2xl mx-auto mt-8">
        <Card>
          <CardHeader>
            <CardTitle>🔍 RLS Debug Tools</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={debugAuthUser}>1. Check Auth User</Button>
              <Button onClick={debugProfile}>2. Check Profile</Button>
              <Button onClick={testPolicyCondition}>3. Test Policy Logic</Button>
              <Button onClick={testRawSQL} variant="secondary">4. Test RPC</Button>
            </div>

            <Button onClick={() => setResults([])} variant="outline" className="w-full">
              Clear Results
            </Button>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg max-h-96 overflow-auto">
              <p className="font-semibold mb-2">Debug Output:</p>
              {results.length === 0 ? (
                <p className="text-gray-500 text-sm">Run tests above</p>
              ) : (
                <div className="space-y-1 font-mono text-xs">
                  {results.map((result, i) => (
                    <div key={i} className="p-2 bg-white rounded border">
                      {result}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}