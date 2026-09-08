// app/api/upload/route.ts
// POST — upload product image to Supabase Storage
// Returns the storage path to save on the product record

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'product-images'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']

export async function POST(req: NextRequest) {
  

  const form = await req.formData()
  const file = form.get('file') as File | null
  const category = (form.get('category') as string) || 'misc'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Only PNG, JPG, WEBP allowed' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()
  const timestamp = Date.now()
  const safeName = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 40)

  // Path: category/filename-timestamp.ext
  const storagePath = `${category}/${safeName}-${timestamp}.${ext}`

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return both the storage path (save to DB) and the public URL (show preview)
  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`

  return NextResponse.json({ path: storagePath, url: publicUrl })
}

// DELETE /api/upload — remove a single image from storage
export async function DELETE(req: NextRequest) {
  

  const { path } = await req.json()
  if (!path) return NextResponse.json({ error: 'No path provided' }, { status: 400 })

  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
