// app/api/get-users/route.js
// Server-side API route pro načtení všech profilů uživatelů
// Používá SUPABASE_SERVICE_ROLE_KEY — pouze pro adminy
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Ověř token volajícího
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Ověř že volající je admin
    const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Načti všechny profily
    const { data, error } = await supabaseAdmin.from('profiles').select('*').order('name,email')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ users: data || [] })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
