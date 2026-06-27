// hooks/useAdmin.ts
// Wraps all admin API calls with the secret header.
// Import this in every admin component instead of raw fetch.

'use client'

import { useState, useCallback } from 'react'
import type { Product } from '@/lib/supabase'

const secret = () => process.env.NEXT_PUBLIC_ADMIN_SECRET || ''

function adminFetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': secret(),
      ...(options.headers || {}),
    },
  })
}

// ─── Products ────────────────────────────────────────────────

export function useProducts() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async (): Promise<Product[]> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/products')
      const json = await res.json()
      return json.products as Product[]
    } catch (e) {
      setError('Error cargando productos')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const createProduct = useCallback(async (data: Partial<Product>): Promise<Product | null> => {
    setLoading(true)
    setError(null)
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
    try {
      const res = await adminFetch(`/api/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error eliminando')
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

// ─── Image Upload ─────────────────────────────────────────────

export function useImageUpload() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadImage = useCallback(
    async (file: File, category: string): Promise<{ path: string; url: string } | null> => {
      setUploading(true)
      setError(null)
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('category', category)

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'x-admin-secret': secret() },
          body: form,
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        return { path: json.path, url: json.url }
      } catch (e: any) {
        setError(e.message || 'Error subiendo imagen')
        return null
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
