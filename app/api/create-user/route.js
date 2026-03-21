// app/api/create-user/route.js
// Server-side API route pro vytváření uživatelů
// Používá SUPABASE_SERVICE_ROLE_KEY — nikdy nesmí být NEXT_PUBLIC_
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    // Ověř že volající je přihlášený admin
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Admin klient se service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Ověř token volajícího uživatele
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Ověř že volající je admin
    const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Načti data nového uživatele
    const { email, password, role, oblast, oblasti, oblasti_edit, oblasti_read, name } = await request.json()
    if (!email || !password) return NextResponse.json({ error: 'Email a heslo jsou povinné' }, { status: 400 })

    // Vytvoř uživatele
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Vytvoř profil
    await supabaseAdmin.from('profiles').upsert({
      id: data.user.id,
      email,
      role: role || 'user',
      oblast: oblast || 'Třebíč',
      oblasti: oblasti || [oblast || 'Třebíč'],
      oblasti_edit: oblasti_edit || oblasti || [oblast || 'Třebíč'],
      oblasti_read: oblasti_read || [],
      name: name || null,
    })

    return NextResponse.json({ user: { id: data.user.id, email, role, oblast, oblasti: oblasti || [oblast || 'Třebíč'], oblasti_edit: oblasti_edit || oblasti || [oblast || 'Třebíč'], oblasti_read: oblasti_read || [], name: name || null } })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
