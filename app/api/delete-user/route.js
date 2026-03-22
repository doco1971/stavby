// app/api/delete-user/route.js
// Build: 20260322_06
// Server-side API route pro smazání uživatele ze Supabase Auth + profiles
// Používá SUPABASE_SERVICE_ROLE_KEY — pouze pro adminy
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    // Ověř volajícího přes cookies (SSR Auth)
    const cookieStore = cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value },
          set() {},
          remove() {},
        },
      }
    )
    const { data: { user: caller }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Admin klient se service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )


    // Ověř že volající je admin
    const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Chybí ID uživatele' }, { status: 400 })

    // Nejdřív smaž profil
    await supabaseAdmin.from('profiles').delete().eq('id', id)

    // Pak smaž ze Supabase Auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
