// app/api/update-user/route.js
// Build: 20260322_04
// Server-side API route pro aktualizaci profilu uživatele
// Používá SUPABASE_SERVICE_ROLE_KEY — pouze pro adminy
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
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

    const { id, oblasti, oblasti_edit, oblasti_read, role, oblast } = await request.json()
    if (!id) return NextResponse.json({ error: 'Chybí ID uživatele' }, { status: 400 })

    // Sestav update objekt jen z poskytnutých polí
    const update = {}
    if (oblasti !== undefined) update.oblasti = oblasti
    if (oblasti_edit !== undefined) update.oblasti_edit = oblasti_edit
    if (oblasti_read !== undefined) update.oblasti_read = oblasti_read
    if (role !== undefined) update.role = role
    if (oblast !== undefined) update.oblast = oblast

    // Pro roli user vždy promazat oblasti_edit a oblasti_read
    if (role === 'user') {
      update.oblasti_edit = []
      update.oblasti_read = []
    }

    const { data: updated, error } = await supabaseAdmin.from('profiles').update(update).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, user: updated })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
