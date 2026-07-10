import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co'
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy'
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy'

export const supabase = createClient(url, anon, {
  global: {
    fetch: (fetchUrl, options) => {
      if (url.includes('dummy.supabase.co')) return Promise.reject(new Error('Dummy DB - Fast Fail'))
      return fetch(fetchUrl, options)
    }
  }
})

export const supabaseAdmin = createClient(url, svc, { 
  auth: { autoRefreshToken: false, persistSession: false },
  global: {
    fetch: (fetchUrl, options) => {
      if (url.includes('dummy.supabase.co')) return Promise.reject(new Error('Dummy DB - Fast Fail'))
      return fetch(fetchUrl, options)
    }
  }
})

export interface Product {
  id: string; name_es: string; cost_mxn: number
  category: 'pipes'|'accessories'|'rolling'|'torches'|'bongs'|'parts'
  price_mxn: number; bundle_pricing: Array<{qty:number;price:number}>
  size_cm: number | null; colors: string[]; sizes?: string[]; description_es: string | null
  image_paths: string[]; in_stock: boolean
  featured: boolean; sort_order: number; slug: string
  created_at: string; updated_at: string
}

export function getImageUrl(path: string): string {
  if (path.startsWith('http') || path.startsWith('/')) return path
  return `/products/${path}`
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').order('category').order('sort_order')
  if (error) throw error
  return data as Product[]
}
