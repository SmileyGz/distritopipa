// app/api/campaigns/[id]/posts/route.ts
// GET  — all posts for a campaign (grouped by week)
// POST — create/upsert a post for a specific date

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAdmin(req: NextRequest) {
  return true}

// GET /api/campaigns/:id/posts
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('campaign_calendar')
    .select('*')
    .eq('campaign_id', params.id)
    .order('scheduled_date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}

// POST /api/campaigns/:id/posts
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { data, error } = await supabaseAdmin
    .from('campaign_posts')
    .insert({ ...body, campaign_id: params.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data }, { status: 201 })
}

// PATCH /api/campaigns/:id/posts — update a post (status, caption, etc.)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { post_id, ...updates } = body

  if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })

  // If marking as posted, record timestamp
  if (updates.status === 'posted' && !updates.posted_at) {
    updates.posted_at = new Date().toISOString()
  }

  const { data, error } = await supabaseAdmin
    .from('campaign_posts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', post_id)
    .eq('campaign_id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}

// DELETE /api/campaigns/:id/posts?post_id=xxx
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const post_id = searchParams.get('post_id')
  if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('campaign_posts')
    .delete()
    .eq('id', post_id)
    .eq('campaign_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
