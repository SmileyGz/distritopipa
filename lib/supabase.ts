import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase      = createClient(url, anon)
export const supabaseAdmin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } })

export interface Product {
  id: string; name_es: string; name_en: string | null
  category: 'pipes'|'accessories'|'rolling'|'torches'|'bongs'|'parts'
  price_mxn: number; bundle_pricing: Array<{qty:number;price:number}>
  size_cm: number | null; colors: string[]; description_es: string | null
  description_en: string | null; image_paths: string[]; in_stock: boolean
  featured: boolean; sort_order: number; slug: string
  created_at: string; updated_at: string
}

export function getImageUrl(path: string): string {
  return `${url}/storage/v1/object/public/product-images/${path}`
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').order('category').order('sort_order')
  if (error) throw error
  return data as Product[]
}
