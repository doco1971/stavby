// app/api/get-users/route.js
// Build: 20260322_03
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Ověř přes Bearer token NEBO přes cookie
    let callerId = null
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      callerId = user?.id
    }

    // Fallback - zkus cookie
    if (!callerId) {
      const cookieStore = cookies()
      const allCookies = cookieStore.getAll()
      const sbCookie = allCookies.find(c => c.name.includes('auth-token'))
      if (sbCookie) {
        try {
          const val = JSON.parse(sbCookie.value)
          const token = val?.access_token || val?.[0]?.access_token
          if (token) {
            const { data: { user } } = await supabaseAdmin.auth.getUser(token)
            callerId = user?.id
          }
        } catch {}
      }
    }

    if (!callerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Ověř že volající je admin
    const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', callerId).single()
    if (callerProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Načti všechny profily
    const { data, error } = await supabaseAdmin.from('profiles').select('*').order('email')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ users: data || [] })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
