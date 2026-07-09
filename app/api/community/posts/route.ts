// app/api/community/posts/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/community/posts
// Handles community Q&A submissions.
// Runs blocklist check server-side (client never sees the list).
// Auto-approves clean posts. Blocks bad ones silently.
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Service role client — used server-side only, never exposed to browser
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // server-side only
)

// Rate limiting: max 3 posts per IP per hour (simple in-memory, upgrade to KV for prod)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= 3) return false
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown'

  // Rate limit
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Demasiadas publicaciones. Intenta más tarde.' },
      { status: 429 }
    )
  }

  let body: {
    author_name: string
    content: string
    category?: string
    parent_id?: string
    customer_id?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
  }

  const { author_name, content, category = 'general', parent_id, customer_id } = body

  // Basic validation
  if (!author_name?.trim() || author_name.length > 50) {
    return NextResponse.json({ error: 'Nombre inválido.' }, { status: 400 })
  }
  if (!content?.trim() || content.length < 5 || content.length > 1000) {
    return NextResponse.json({ error: 'El mensaje debe tener entre 5 y 1000 caracteres.' }, { status: 400 })
  }

  // Server-side blocklist check via Postgres function
  const { data: moderation, error: modError } = await supabase
    .rpc('check_post_content', { post_text: content })
    .single()

  if (modError) {
    console.error('Moderation check error:', modError)
    // Fail open — log it but don't block the user for a system error
  }

  const isBlocked = (moderation as any)?.blocked === true
  const status = isBlocked ? 'blocked' : 'approved'

  // Insert the post regardless of outcome (blocked posts stay hidden)
  const { data: post, error } = await supabase
    .from('community_posts')
    .insert({
      author_name: author_name.trim(),
      content: content.trim(),
      category,
      parent_id: parent_id || null,
      customer_id: customer_id || null,
      status,
      block_reason: isBlocked ? `Blocked word: ${(moderation as any)?.matched_word}` : null,
    })
    .select('id, status, created_at')
    .single()

  if (error) {
    console.error('Post insert error:', error)
    return NextResponse.json({ error: 'Error al publicar. Intenta de nuevo.' }, { status: 500 })
  }

  // Always return success to the user — never reveal why a post was blocked
  // (prevents evasion — user sees "publicado!" even if it's blocked)
  return NextResponse.json({
    success: true,
    post_id: post.id,
    message: '¡Publicado! Tu mensaje ya está visible en la comunidad.',
  })
}

// GET /api/community/posts?category=general&limit=20&offset=0
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const offset = parseInt(searchParams.get('offset') || '0')
  const parent_id = searchParams.get('parent_id')

  let query = supabase
    .from('community_posts')
    .select('id, author_name, content, category, upvotes, created_at, parent_id')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (category && category !== 'all') query = query.eq('category', category)
  if (parent_id) query = query.eq('parent_id', parent_id)
  else query = query.is('parent_id', null) // top-level posts only

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Error al cargar.' }, { status: 500 })
  }

  return NextResponse.json({ posts: data })
}
