'use client'

import Link from 'next/link'
import { getImageUrl, type Product } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import toast from 'react-hot-toast'

export default function FeaturedCard({ product }: { product: Product }) {
  const name  = product.name_es
  const price = product.price_mxn
  const imageUrl = product.image_paths?.[0] ? getImageUrl(product.image_paths[0]) : null

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    useStore.getState().addToCart(product, 1)
    toast.success(`Agregado: ${name}`)
  }

  return (
    <div className="feat-card">
      <Link href={`/producto/${product.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        <div className="feat-img">
          {imageUrl ? <img src={imageUrl} alt={name} /> : <span className="feat-placeholder">📦</span>}
          <span className="feat-star">★</span>
        </div>
        <div className="feat-name">{name}</div>
        <div className="feat-meta">{product.category} {product.size_cm ? `· ${product.size_cm}cm` : ''}</div>
        <div className="feat-price">${price}</div>
      </Link>
      <button className="feat-cta-btn" onClick={handleAddToCart}>
        🛒 Agregar
      </button>
    </div>
  )
}
