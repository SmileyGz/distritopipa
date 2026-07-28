'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getImageUrl, type Product } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import toast from 'react-hot-toast'

interface Props {
  product: Product
}

export default function ProductPageClient({ product }: Props) {
  const name = product.name_es
  const desc = product.description_es

  const [selectedColor, setSelectedColor] = useState<string | null>(product.colors?.[0] || null)
  const [selectedSize, setSelectedSize] = useState<string | null>(product.sizes?.[0] || null)
  const [quantity, setQuantity] = useState(1)

  const basePrice = product.price_mxn
  let effectivePrice = basePrice * quantity
  let discount = 0
  
  if (product.bundle_pricing && product.bundle_pricing.length > 0) {
    let remainingQty = quantity;
    let bestPriceTotal = 0;
    const tiers = [...product.bundle_pricing].sort((a, b) => b.qty - a.qty);
    for (const tier of tiers) {
      if (remainingQty >= tier.qty) {
        const bundles = Math.floor(remainingQty / tier.qty);
        bestPriceTotal += bundles * tier.price;
        remainingQty %= tier.qty;
      }
    }
    bestPriceTotal += remainingQty * basePrice;
    discount = (basePrice * quantity) - bestPriceTotal;
    effectivePrice = bestPriceTotal;
  }

  return (
    <main className="product-page">
      <div className="product-container">
        
        {/* Navigation / Breadcrumb */}
        <nav className="breadcrumb">
          <Link href="/">Inicio</Link> &gt; <Link href="/catalogo">Catálogo</Link> &gt; <span>{name}</span>
        </nav>

        <div className="product-grid">
          {/* Images */}
          <div className="product-gallery">
            {product.image_paths && product.image_paths.length > 0 ? (
              <div className="main-image">
                <Image
                  src={getImageUrl(product.image_paths[0])}
                  alt={name}
                  width={500}
                  height={500}
                  quality={90}
                  priority
                  style={{ objectFit: 'contain', width: '100%', height: 'auto' }}
                />
              </div>
            ) : (
              <div className="main-image placeholder">📦</div>
            )}
          </div>

          {/* Info section */}
          <div className="product-info">
            <h1 className="product-title">{name}</h1>
            <p className="product-description">{desc}</p>

            {/* Metadata */}
            <div className="product-meta">
              {product.size_cm && (
                <div className="meta-item">
                  <span className="meta-label">Tamaño:</span>
                  <span className="meta-value">{product.size_cm} cm</span>
                </div>
              )}
              {product.in_stock ? (
                <div className="meta-item">
                  <span className="meta-label">Disponibilidad:</span>
                  <span className="meta-value in-stock">✓ En stock en Cancún</span>
                </div>
              ) : (
                <div className="meta-item">
                  <span className="meta-label">Disponibilidad:</span>
                  <span className="meta-value out-of-stock">Agotado temporalmente</span>
                </div>
              )}
            </div>

            {/* Size selector */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="selector-group">
                <label className="selector-label">Talla / Modelo</label>
                <div className="size-options">
                  {product.sizes.map(s => (
                    <button
                      key={s}
                      className={`size-btn ${selectedSize === s ? 'active' : ''}`}
                      onClick={() => setSelectedSize(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color selector */}
            {product.colors && product.colors.length > 0 && (
              <div className="selector-group">
                <label className="selector-label">Color</label>
                <div className="color-swatches">
                  {product.colors.map(color => (
                    <button
                      key={color}
                      className={`swatch ${selectedColor === color ? 'active' : ''}`}
                      onClick={() => setSelectedColor(color)}
                      style={{ backgroundColor: getColorHex(color) }}
                      title={color}
                    >
                      {selectedColor === color && <span className="checkmark">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bundle / quantity options */}
            <div className="selector-group">
              <label className="selector-label">Cantidad</label>

              {product.bundle_pricing && product.bundle_pricing.length > 0 && (
                <div className="promo-banner">
                  <div className="promo-title">🔥 Promociones por Volumen</div>
                  <div className="promo-list">
                    {product.bundle_pricing.map(bundle => (
                      <span key={bundle.qty} className="promo-chip">
                        Lleva {bundle.qty}x por ${bundle.price} (Ahorra ${Math.round(basePrice * bundle.qty - bundle.price)})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="quantity-stepper">
                <button className="stepper-btn" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
                <input type="number" min="1" max="99" value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="stepper-input" />
                <button className="stepper-btn" onClick={() => setQuantity(Math.min(99, quantity + 1))}>+</button>
              </div>
            </div>

            {/* Price summary */}
            <div className="price-summary">
              <div className="price-line">
                <span>Total estimado:</span>
                <div>
                  {discount > 0 && (
                    <span className="original-price" style={{ textDecoration: 'line-through', color: '#888', marginRight: '8px', fontSize: '14px' }}>
                      ${(basePrice * quantity).toLocaleString('es-MX')}
                    </span>
                  )}
                  <span className="total-price">${effectivePrice.toLocaleString('es-MX')}</span>
                </div>
              </div>
              <p className="price-note">Asegura tu pedido con $50 MXN. Entrega inmediata en Cancún.</p>
            </div>

            {/* CTAs */}
            <div className="cta-group">
              <button
                onClick={() => {
                  if (product.sizes?.length && !selectedSize) return toast.error('Selecciona una talla.')
                  if (product.colors?.length && !selectedColor) return toast.error('Selecciona un color.')
                  useStore.getState().addToCart(product, quantity, selectedSize, selectedColor)
                  toast.success(`Agregado: ${quantity}x ${name}`)
                }}
                className="cta-primary"
              >
                🛒 Agregar al carrito
              </button>
            </div>

            {/* Social Proof (Anti-Abandon) */}
            <div className="product-social-proof">
               <div className="trust-badge">
                 <span>⭐️ Recomendados por +120 vecinos en Cancún</span>
               </div>
               <div className="discrete-assurance-mini">
                 <span className="da-icon">📦</span>
                 <span>Empaque 100% discreto garantizado. Nadie sabrá qué hay adentro.</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .product-page { min-height: 100vh; background: #111; color: #fff; padding: 20px; }
        .product-container { max-width: 1000px; margin: 0 auto; }
        
        .breadcrumb { font-size: 13px; color: #888; margin-bottom: 24px; }
        .breadcrumb a { color: #CC2222; text-decoration: none; }
        .breadcrumb span { color: #ccc; }

        .product-grid { display: grid; gap: 40px; }
        @media (min-width: 768px) { .product-grid { grid-template-columns: 1fr 1fr; } }

        .product-gallery .main-image { background: #1a1a1a; border-radius: 16px; border: 1px solid #2a2a2a; overflow: hidden; padding: 20px; display: flex; align-items: center; justify-content: center; }
        .product-gallery .placeholder { aspect-ratio: 1; font-size: 64px; }

        .product-title { font-size: 32px; font-weight: 700; margin-bottom: 12px; font-family: var(--font-bebas), sans-serif; letter-spacing: 0.02em; }
        .product-description { font-size: 15px; color: #aaa; line-height: 1.6; margin-bottom: 24px; }

        .product-meta { background: #1a1a1a; padding: 16px; border-radius: 12px; border: 1px solid #2a2a2a; margin-bottom: 24px; display: flex; flex-direction: column; gap: 12px; }
        .meta-item { display: flex; justify-content: space-between; font-size: 14px; }
        .meta-label { color: #888; }
        .meta-value { font-weight: 600; }
        .in-stock { color: #4ade80; }
        .out-of-stock { color: #ef4444; }

        .selector-group { margin-bottom: 24px; }
        .selector-label { display: block; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        
        .size-options { display: flex; gap: 10px; flex-wrap: wrap; }
        .size-btn { background: #1a1a1a; border: 1px solid #2a2a2a; color: #fff; padding: 10px 20px; border-radius: 8px; cursor: pointer; transition: 0.2s; }
        .size-btn:hover { border-color: #CC2222; }
        .size-btn.active { background: rgba(204,34,34,0.1); border-color: #CC2222; }

        .color-swatches { display: flex; gap: 12px; flex-wrap: wrap; }
        .swatch { width: 40px; height: 40px; border-radius: 50%; border: 2px solid #2a2a2a; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; transition: 0.2s; }
        .swatch:hover { border-color: #CC2222; }
        .swatch.active { border-color: #CC2222; box-shadow: 0 0 0 2px #111, 0 0 0 4px #CC2222; }
        .checkmark { color: #fff; font-size: 18px; text-shadow: 0 0 4px rgba(0,0,0,0.5); }

        .quantity-stepper { display: flex; align-items: center; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; width: fit-content; }
        .stepper-btn { background: transparent; border: none; color: #fff; font-size: 20px; width: 44px; height: 44px; cursor: pointer; }
        .stepper-input { width: 50px; background: transparent; border: none; border-left: 1px solid #2a2a2a; border-right: 1px solid #2a2a2a; color: #fff; text-align: center; height: 44px; font-size: 16px; }
        .stepper-input:focus { outline: none; }

        .promo-banner { background: rgba(204,34,34,0.1); border: 1px solid rgba(204,34,34,0.2); border-radius: 8px; padding: 12px; margin-bottom: 16px; }
        .promo-title { color: #CC2222; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
        .promo-chip { display: block; font-size: 13px; color: #fff; margin-bottom: 4px; }

        .price-summary { background: #1a1a1a; border: 1px solid #2a2a2a; padding: 20px; border-radius: 12px; margin-bottom: 24px; }
        .price-line { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .total-price { font-size: 24px; font-weight: 700; color: #CC2222; }
        .price-note { font-size: 12px; color: #888; margin: 0; }

        .cta-primary { width: 100%; padding: 16px; background: #CC2222; color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .cta-primary:hover { background: #b81032; }

        .product-social-proof { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; text-align: center; }
        .trust-badge { font-size: 12px; color: #888; }
        .trust-badge span { background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; display: inline-block; }
        .discrete-assurance-mini { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: #aaa; background: rgba(255,255,255,0.02); padding: 8px; border-radius: 6px; border: 1px dashed #333; }
        .da-icon { font-size: 16px; }
      `}</style>
    </main>
  )
}

function getColorHex(colorName: string): string {
  const colorMap: Record<string, string> = {
    rojo: '#ef4444', red: '#ef4444', verde: '#22c55e', green: '#22c55e',
    azul: '#3b82f6', blue: '#3b82f6', amarillo: '#eab308', yellow: '#eab308',
    negro: '#1f2937', black: '#1f2937', blanco: '#f3f4f6', white: '#f3f4f6',
    gris: '#9ca3af', gray: '#9ca3af', naranja: '#f97316', orange: '#f97316',
    púrpura: '#a855f7', purple: '#a855f7', rosa: '#ec4899', pink: '#ec4899',
  }
  return colorMap[colorName.toLowerCase()] || '#6b7280'
}
