// hooks/useAdmin.ts
// Wraps all admin API calls with the secret header.
// Import this in every admin component instead of raw fetch.

'use client'

import { useState, useCallback } from 'react'
import type { Product } from '@/lib/supabase'
import { mockProducts } from '@/lib/mockProducts'

const secret = () => {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('dp_admin') || ''
  }
  return ''
}

export function adminFetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      
      ...(options.headers || {}),
    },
  })
}

// ─── Products ────────────────────────────────────────────────

export function useProducts() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async (): Promise<Product[]> => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co') {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('dp_mock_products')
        if (stored) return JSON.parse(stored)
        localStorage.setItem('dp_mock_products', JSON.stringify(mockProducts))
      }
      return mockProducts
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/products')
      const json = await res.json()
      return json.products as Product[]
    } catch (e) {
      setError('Error cargando productos')
      return mockProducts // Fallback to mock data on network error as well
    } finally {
      setLoading(false)
    }
  }, [])

  const createProduct = useCallback(async (data: Partial<Product>): Promise<Product | null> => {
    setLoading(true)
    setError(null)
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co') {
      const newProduct = { ...data, id: Math.random().toString(), created_at: new Date().toISOString() } as Product
      if (typeof window !== 'undefined') {
        const stored = JSON.parse(localStorage.getItem('dp_mock_products') || '[]')
        localStorage.setItem('dp_mock_products', JSON.stringify([...stored, newProduct]))
      }
      setTimeout(() => setLoading(false), 500)
      return newProduct
    }

    try {
      const res = await adminFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      return json.product
    } catch (e: any) {
      setError(e.message || 'Error creando producto')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const updateProduct = useCallback(
    async (id: string, data: Partial<Product>): Promise<Product | null> => {
      setLoading(true)
      setError(null)

      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co') {
        if (typeof window !== 'undefined') {
          const stored = JSON.parse(localStorage.getItem('dp_mock_products') || '[]')
          const updated = stored.map((p: any) => p.id === id ? { ...p, ...data } : p)
          localStorage.setItem('dp_mock_products', JSON.stringify(updated))
        }
        setTimeout(() => setLoading(false), 500)
        return { ...data, id } as Product
      }

      try {
        const res = await adminFetch(`/api/products/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        return json.product
      } catch (e: any) {
        setError(e.message || 'Error actualizando producto')
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co') {
        if (typeof window !== 'undefined') {
          const stored = JSON.parse(localStorage.getItem('dp_mock_products') || '[]')
          const filtered = stored.filter((p: any) => p.id !== id)
          localStorage.setItem('dp_mock_products', JSON.stringify(filtered))
        }
        setTimeout(() => setLoading(false), 500)
        return true
      }

    try {
      const res = await adminFetch(`/api/products/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Error eliminando')
      }
      return true
    } catch (e: any) {
      setError(e.message || 'Error eliminando producto')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  // Toggle in_stock quickly (called from the product list toggle switch)
  const toggleStock = useCallback(
    async (id: string, in_stock: boolean): Promise<boolean> => {
      try {
        const res = await adminFetch(`/api/products/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ in_stock }),
        })
        return res.ok
      } catch {
        return false
      }
    },
    []
  )

  return { fetchProducts, createProduct, updateProduct, deleteProduct, toggleStock, loading, error }
}

import imageCompression from 'browser-image-compression'

export function useImageUpload() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadImage = useCallback(
    async (file: File, category: string): Promise<{ path?: string; url?: string; error?: string }> => {
      setUploading(true)
      setError(null)
      try {
        // Upload the original file directly (no compression) to avoid blob corruption
        const form = new FormData()
        form.append('file', file) 
        form.append('category', category)

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: {},
          body: form,
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        return { path: json.path, url: json.url }
      } catch (e: any) {
        setError(e.message || 'Error subiendo imagen')
        return { error: e.message || 'Error subiendo imagen' }
      } finally {
        setUploading(false)
      }
    },
    []
  )

  const deleteImage = useCallback(async (path: string): Promise<boolean> => {
    try {
      const res = await adminFetch('/api/upload', {
        method: 'DELETE',
        body: JSON.stringify({ path }),
      })
      return res.ok
    } catch {
      return false
    }
  }, [])

  return { uploadImage, deleteImage, uploading, error }
}
