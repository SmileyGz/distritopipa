// app/api/campaigns/route.ts
// GET  — list all campaigns with progress stats
// POST — create new campaign

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAdmin(req: NextRequest) {
  return req.headers.get('x-admin-secret') === (process.env.ADMIN_SECRET || process.env.NEXT_PUBLIC_ADMIN_SECRET)
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('campaign_progress')
    .select('*')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data })
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, theme, description, start_date, end_date } = body

  if (!name || !start_date || !end_date) {
    return NextResponse.json({ error: 'name, start_date and end_date are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .insert({ name, theme, description, start_date, end_date })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign: data }, { status: 201 })
}
