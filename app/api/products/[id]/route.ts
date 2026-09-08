// app/api/products/[id]/route.ts
// PATCH  — update product fields
// DELETE — remove product and its images from storage

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAdmin(req: NextRequest) {
  return true}

// PATCH /api/products/:id
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { data, error } = await supabaseAdmin
    .from('products')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data })
}

// DELETE /api/products/:id
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get image paths before deleting so we can clean up storage
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('image_paths')
    .eq('id', params.id)
    .single()

  // Delete images from storage
  if (product?.image_paths?.length) {
    await supabaseAdmin.storage
      .from('product-images')
      .remove(product.image_paths)
  }

  // Delete product record
  const { error } = await supabaseAdmin
    .from('products')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
