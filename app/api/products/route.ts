// app/api/products/route.ts
// GET  — public shelf reads
// POST — admin creates product (service role)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getProducts } from '@/lib/supabase'

// GET /api/products — used by the shelf
export async function GET() {
  try {
    const products = await getProducts()
    return NextResponse.json({ products })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })
  }
}

// POST /api/products — admin creates new product
export async function POST(req: NextRequest) {
  // Simple admin guard — check for secret header
  // Upgrade to proper NextAuth session when ready
  const secret = req.headers.get('x-admin-secret')
  if (secret !== (process.env.ADMIN_SECRET || process.env.NEXT_PUBLIC_ADMIN_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  
  // Generate a URL-friendly slug from the Spanish name if not provided
  if (!body.slug && body.name_es) {
    body.slug = body.name_es
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9]+/g, '-') // Replace spaces/special chars with hyphens
      .replace(/(^-|-$)+/g, '') // Trim hyphens from start and end
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data }, { status: 201 })
}

// ─────────────────────────────────────────────────────────────
// app/api/products/[id]/route.ts
// PATCH — update product
// DELETE — delete product
// ─────────────────────────────────────────────────────────────
