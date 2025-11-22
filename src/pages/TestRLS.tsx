import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

export default function TestRLS() {
  const [results, setResults] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const addResult = (message: string) => {
    setResults(prev => [...prev, message])
  }

  const checkRole = async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        addResult("❌ No user logged in")
        setIsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) {
        addResult(`❌ Error checking role: ${error.message}`)
      } else {
        addResult(`🔍 Your role: ${data.role}`)
      }
    } catch (err) {
      addResult(`❌ Error: ${err}`)
    }
    setIsLoading(false)
  }

  const testReadContacts = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')

      if (error) {
        addResult(`❌ READ ERROR: ${error.message}`)
      } else {
        addResult(`✅ READ SUCCESS: Found ${data.length} contacts`)
      }
    } catch (err) {
      addResult(`❌ READ ERROR: ${err}`)
    }
    setIsLoading(false)
  }

  const testInsertContact = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('contacts')
        .insert({
          first_name: 'Test',
          last_name: 'RLS',
          phone: '+9999999999',
          birthday: '2000-01-01'
        })

      if (error) {
        if (error.message.includes('row-level security') || error.message.includes('policy')) {
          addResult(`✅ INSERT BLOCKED: ${error.message.substring(0, 80)}... (This is correct!)`)
        } else {
          addResult(`⚠️ INSERT ERROR: ${error.message}`)
        }
      } else {
        addResult(`❌ INSERT ALLOWED: This should NOT happen for user role!`)
      }
    } catch (err) {
      addResult(`❌ INSERT ERROR: ${err}`)
    }
    setIsLoading(false)
  }

  const testUpdateContact = async () => {
    setIsLoading(true)
    try {
      // First, get the first contact
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id')
        .limit(1)

      if (!contacts || contacts.length === 0) {
        addResult(`⚠️ No contacts to update`)
        setIsLoading(false)
        return
      }

      const { error } = await supabase
        .from('contacts')
        .update({ notes: 'RLS test update' })
        .eq('id', contacts[0].id)

      if (error) {
        if (error.message.includes('row-level security') || error.message.includes('policy')) {
          addResult(`✅ UPDATE BLOCKED: ${error.message.substring(0, 80)}... (This is correct!)`)
        } else {
          addResult(`⚠️ UPDATE ERROR: ${error.message}`)
        }
      } else {
        addResult(`❌ UPDATE ALLOWED: This should NOT happen for user role!`)
      }
    } catch (err) {
      addResult(`❌ UPDATE ERROR: ${err}`)
    }
    setIsLoading(false)
  }

  const testDeleteContact = async () => {
    setIsLoading(true)
    try {
      // Try to delete any contact with 'Test' in the name
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('first_name', 'Test')

      if (error) {
        if (error.message.includes('row-level security') || error.message.includes('policy')) {
          addResult(`✅ DELETE BLOCKED: ${error.message.substring(0, 80)}... (This is correct!)`)
        } else {
          addResult(`⚠️ DELETE ERROR: ${error.message}`)
        }
      } else {
        addResult(`❌ DELETE ALLOWED: This should NOT happen for user role!`)
      }
    } catch (err) {
      addResult(`❌ DELETE ERROR: ${err}`)
    }
    setIsLoading(false)
  }

  const runAllTests = async () => {
    setResults([])
    await checkRole()
    await new Promise(resolve => setTimeout(resolve, 300))
    await testReadContacts()
    await new Promise(resolve => setTimeout(resolve, 300))
    await testInsertContact()
    await new Promise(resolve => setTimeout(resolve, 300))
    await testUpdateContact()
    await new Promise(resolve => setTimeout(resolve, 300))
    await testDeleteContact()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
      <div className="max-w-2xl mx-auto mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔒 RLS Security Test
              <span className="text-sm font-normal text-gray-500">
                (Testing with RESTRICTIVE policies)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={runAllTests} disabled={isLoading} size="lg">
                {isLoading ? "Running..." : "🚀 Run All Tests"}
              </Button>
              <Button onClick={() => setResults([])} variant="outline" disabled={isLoading}>
                Clear Results
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={checkRole} variant="secondary" disabled={isLoading} size="sm">
                Check My Role
              </Button>
              <Button onClick={testReadContacts} variant="secondary" disabled={isLoading} size="sm">
                Test READ
              </Button>
              <Button onClick={testInsertContact} variant="secondary" disabled={isLoading} size="sm">
                Test INSERT
              </Button>
              <Button onClick={testUpdateContact} variant="secondary" disabled={isLoading} size="sm">
                Test UPDATE
              </Button>
              <Button onClick={testDeleteContact} variant="destructive" disabled={isLoading} size="sm">
                Test DELETE
              </Button>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg max-h-96 overflow-auto">
              <p className="font-semibold mb-2">Test Results:</p>
              {results.length === 0 ? (
                <p className="text-gray-500 text-sm">No tests run yet. Click "Run All Tests" to start!</p>
              ) : (
                <div className="space-y-1">
                  {results.map((result, i) => (
                    <div key={i} className="text-sm font-mono p-2 bg-white rounded border">
                      {result}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800 font-semibold mb-1">Expected Results:</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>✅ Role should be "user"</li>
                <li>✅ READ should succeed</li>
                <li>✅ INSERT should be BLOCKED</li>
                <li>✅ UPDATE should be BLOCKED</li>
                <li>✅ DELETE should be BLOCKED</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}