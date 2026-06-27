// components/ProductDetail.tsx
// ─────────────────────────────────────────────────────────────
// Bottom sheet drawer — full product details.
// Appears when user taps a product card.
// Shows images, description, color/bundle options, WhatsApp CTA.
// ─────────────────────────────────────────────────────────────

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Product } from './Shelf'

interface ProductDetailProps {
  product: Product
  language: 'es' | 'en'
  onClose: () => void
}

export default function ProductDetail({ product, language, onClose }: ProductDetailProps) {
  const name = language === 'es' ? product.name_es : product.name_en
  const desc = language === 'es' ? product.description_es : product.description_en

  const [selectedColor, setSelectedColor] = useState<string | null>(product.colors?.[0] || null)
  const [quantity, setQuantity] = useState(1)
  const [selectedBundleQty, setSelectedBundleQty] = useState<number | null>(null)

  // Determine effective price
  const basePrice = product.price_mxn
  let effectivePrice = basePrice * quantity
  let bundleLabel = ''

  if (selectedBundleQty && product.bundle_pricing) {
    const bundle = product.bundle_pricing.find(b => b.qty === selectedBundleQty)
    if (bundle) {
      effectivePrice = bundle.price * quantity
      bundleLabel = `${selectedBundleQty}x paquete`
    }
  }

  // Build WhatsApp message
  const buildWhatsAppMessage = () => {
    let msg = `Hola! Quiero reservar:\n\n`
    msg += `📦 ${name}\n`
    msg += `Cantidad: ${quantity}\n`
    if (selectedColor) msg += `Color: ${selectedColor}\n`
    if (bundleLabel) msg += `Opción: ${bundleLabel}\n`
    msg += `\nTotal estimado: $${effectivePrice.toLocaleString('es-MX')} MXN\n\n`
    msg += `¿Está disponible? ¿Cuál sería la fecha de entrega?`
    return encodeURIComponent(msg)
  }

  const whatsappUrl = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '528987099999'}?text=${buildWhatsAppMessage()}`

  const drawerVariants = {
    hidden: { y: '100%', opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', damping: 30, stiffness: 300 },
    },
    exit: {
      y: '100%',
      opacity: 0,
      transition: { duration: 0.2 },
    },
  }

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="detail-backdrop"
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <motion.div
        className="detail-drawer"
        variants={drawerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
      >
        {/* Handle bar + close */}
        <div className="drawer-header">
          <div className="handle" aria-hidden="true" />
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="drawer-content">
          {/* Images carousel */}
          {product.images && product.images.length > 0 && (
            <div className="image-carousel">
              {product.images.map((img, idx) => (
                <div key={idx} className="carousel-item">
                  <Image
                    src={img.asset.url}
                    alt={`${name} - imagen ${idx + 1}`}
                    width={400}
                    height={400}
                    quality={90}
                    priority={idx === 0}
                    style={{ objectFit: 'contain', width: '100%', height: 'auto' }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Info section */}
          <div className="info-section">
            <h2 id="product-detail-title" className="detail-title">
              {name}
            </h2>

            <p className="detail-description">{desc}</p>

            {/* Metadata */}
            <div className="detail-meta">
              {product.size_cm && (
                <div className="meta-item">
                  <span className="meta-label">Tamaño:</span>
                  <span className="meta-value">{product.size_cm} cm</span>
                </div>
              )}
              {product.in_stock ? (
                <div className="meta-item">
                  <span className="meta-label">Disponibilidad:</span>
                  <span className="meta-value in-stock">✓ En stock</span>
                </div>
              ) : (
                <div className="meta-item">
                  <span className="meta-label">Disponibilidad:</span>
                  <span className="meta-value out-of-stock">Agotado</span>
                </div>
              )}
            </div>

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
                      aria-label={`Seleccionar color ${color}`}
                      aria-pressed={selectedColor === color}
                      title={color}
                    >
                      {selectedColor === color && <span className="checkmark">✓</span>}
                    </button>
                  ))}
                </div>
                {selectedColor && (
                  <p className="selected-color-label">{selectedColor}</p>
                )}
              </div>
            )}

            {/* Bundle / quantity options */}
            <div className="selector-group">
              <label className="selector-label">Cantidad</label>

              {product.bundle_pricing && product.bundle_pricing.length > 0 && (
                <div className="bundle-options">
                  <button
                    className={`bundle-btn ${selectedBundleQty === null ? 'active' : ''}`}
                    onClick={() => setSelectedBundleQty(null)}
                  >
                    <span className="bundle-qty">1</span>
                    <span className="bundle-price">${basePrice}</span>
                  </button>
                  {product.bundle_pricing.map(bundle => (
                    <button
                      key={bundle.qty}
                      className={`bundle-btn ${selectedBundleQty === bundle.qty ? 'active' : ''}`}
                      onClick={() => setSelectedBundleQty(bundle.qty)}
                    >
                      <span className="bundle-qty">{bundle.qty}x</span>
                      <span className="bundle-price">${bundle.price}</span>
                      <span className="bundle-save">
                        Ahorra ${Math.round((basePrice * bundle.qty - bundle.price) / 100) * 100}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Quantity stepper */}
              <div className="quantity-stepper">
                <button
                  className="stepper-btn"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Disminuir cantidad"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="stepper-input"
                  aria-label="Cantidad de productos"
                />
                <button
                  className="stepper-btn"
                  onClick={() => setQuantity(Math.min(99, quantity + 1))}
                  aria-label="Aumentar cantidad"
                >
                  +
                </button>
              </div>
            </div>

            {/* Price summary */}
            <div className="price-summary">
              <div className="price-line">
                <span>Total estimado:</span>
                <span className="total-price">${effectivePrice.toLocaleString('es-MX')}</span>
              </div>
              <p className="price-note">Anticipo (25%) y opciones de entrega en el siguiente paso.</p>
            </div>

            {/* CTAs */}
            <div className="cta-group">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-primary"
              >
                💬 Reservar via WhatsApp
              </a>

              <button className="cta-secondary" onClick={onClose}>
                Seguir viendo el estante
              </button>
            </div>

            {/* Community link */}
            <div className="community-link">
              <p className="community-text">
                ¿Tienes preguntas? Pregunta en la comunidad.
              </p>
              <a href="/comunidad" className="community-btn">
                Ver preguntas frecuentes →
              </a>
            </div>
          </div>
        </div>
      </motion.div>

      <style>{`
        .detail-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 98;
        }

        .detail-drawer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          top: 40%;
          max-height: 90vh;
          background: #111;
          border-top: 1px solid #2a2a2a;
          border-radius: 20px 20px 0 0;
          z-index: 99;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        @media (max-height: 640px) {
          .detail-drawer {
            top: 10%;
          }
        }

        .drawer-header {
          flex-shrink: 0;
          padding: 12px 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
        }

        .handle {
          width: 40px;
          height: 4px;
          background: #2a2a2a;
          border-radius: 2px;
        }

        .close-btn {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #888;
          font-size: 20px;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .close-btn:hover {
          color: #fff;
        }

        .drawer-content {
          flex: 1;
          overflow-y: auto;
          padding: 0;
        }

        .drawer-content::-webkit-scrollbar {
          width: 6px;
        }

        .drawer-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .drawer-content::-webkit-scrollbar-thumb {
          background: #2a2a2a;
          border-radius: 3px;
        }

        .image-carousel {
          width: 100%;
          aspect-ratio: 1;
          background: #1a1a1a;
          display: flex;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
        }

        .carousel-item {
          flex: 0 0 100%;
          scroll-snap-align: start;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .info-section {
          padding: 24px 20px 32px;
        }

        .detail-title {
          font-size: 24px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 12px 0;
          line-height: 1.2;
        }

        .detail-description {
          font-size: 14px;
          color: #888;
          line-height: 1.6;
          margin: 0 0 16px 0;
        }

        .detail-meta {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
          padding: 12px;
          background: #1a1a1a;
          border-radius: 8px;
        }

        .meta-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }

        .meta-label {
          color: #888;
        }

        .meta-value {
          color: #fff;
          font-weight: 500;
        }

        .meta-value.in-stock {
          color: #4ade80;
        }

        .meta-value.out-of-stock {
          color: #ef4444;
        }

        .selector-group {
          margin-bottom: 20px;
        }

        .selector-label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 10px;
        }

        .color-swatches {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 8px;
        }

        .swatch {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 2px solid #2a2a2a;
          cursor: pointer;
          position: relative;
          transition: all 0.2s;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .swatch:hover {
          border-color: #CC2222;
        }

        .swatch.active {
          border-color: #CC2222;
          box-shadow: 0 0 0 2px #111, 0 0 0 4px #CC2222;
        }

        .checkmark {
          color: #fff;
          font-size: 20px;
          font-weight: bold;
          text-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
        }

        .selected-color-label {
          font-size: 12px;
          color: #888;
          margin: 8px 0 0 0;
          font-style: italic;
        }

        .bundle-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .bundle-btn {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          color: #fff;
          font-size: 13px;
        }

        .bundle-btn:hover {
          border-color: #CC2222;
          background: #262626;
        }

        .bundle-btn.active {
          border-color: #CC2222;
          background: rgba(204, 34, 34, 0.1);
        }

        .bundle-qty {
          font-weight: 600;
          min-width: 40px;
        }

        .bundle-price {
          color: #CC2222;
          font-weight: 600;
        }

        .bundle-save {
          font-size: 11px;
          color: #4ade80;
          margin-left: auto;
        }

        .quantity-stepper {
          display: flex;
          align-items: center;
          gap: 0;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          width: fit-content;
        }

        .stepper-btn {
          flex: 0 0 40px;
          height: 40px;
          background: transparent;
          border: none;
          color: #888;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .stepper-btn:hover {
          color: #fff;
        }

        .stepper-input {
          flex: 0 0 60px;
          height: 40px;
          border: none;
          background: transparent;
          color: #fff;
          text-align: center;
          font-size: 14px;
          font-weight: 600;
          border-left: 1px solid #2a2a2a;
          border-right: 1px solid #2a2a2a;
        }

        .stepper-input:focus {
          outline: none;
        }

        /* Hide spinner in Chrome, Safari, Edge, Opera */
        .stepper-input::-webkit-outer-spin-button,
        .stepper-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        /* Firefox */
        .stepper-input[type=number] {
          -moz-appearance: textfield;
        }

        .price-summary {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 14px;
          margin-bottom: 20px;
        }

        .price-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          color: #fff;
          margin-bottom: 6px;
        }

        .total-price {
          font-size: 18px;
          font-weight: 600;
          color: #CC2222;
        }

        .price-note {
          font-size: 11px;
          color: #888;
          margin: 0;
        }

        .cta-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }

        .cta-primary,
        .cta-secondary {
          padding: 14px 0;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          text-align: center;
          display: block;
          transition: all 0.2s;
          border: none;
          letter-spacing: 0.02em;
        }

        .cta-primary {
          background: #CC2222;
          color: #fff;
        }

        .cta-primary:hover {
          background: #e02222;
          transform: translateY(-1px);
        }

        .cta-primary:active {
          transform: translateY(0);
        }

        .cta-secondary {
          background: #1a1a1a;
          color: #888;
          border: 1px solid #2a2a2a;
        }

        .cta-secondary:hover {
          color: #fff;
          border-color: #CC2222;
        }

        .community-link {
          text-align: center;
          padding-top: 12px;
          border-top: 1px solid #2a2a2a;
        }

        .community-text {
          font-size: 12px;
          color: #888;
          margin: 0 0 8px 0;
        }

        .community-btn {
          font-size: 12px;
          color: #CC2222;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }

        .community-btn:hover {
          color: #e02222;
        }

        @media (prefers-reduced-motion: reduce) {
          .detail-drawer,
          .close-btn,
          .swatch,
          .bundle-btn,
          .cta-primary,
          .cta-secondary {
            transition: none;
          }
        }
      `}</style>
    </>
  )
}

// Helper function to convert color names to hex (expand as needed)
function getColorHex(colorName: string): string {
  const colorMap: Record<string, string> = {
    rojo: '#ef4444',
    red: '#ef4444',
    verde: '#22c55e',
    green: '#22c55e',
    azul: '#3b82f6',
    blue: '#3b82f6',
    amarillo: '#eab308',
    yellow: '#eab308',
    negro: '#1f2937',
    black: '#1f2937',
    blanco: '#f3f4f6',
    white: '#f3f4f6',
    gris: '#9ca3af',
    gray: '#9ca3af',
    naranja: '#f97316',
    orange: '#f97316',
    púrpura: '#a855f7',
    purple: '#a855f7',
    rosa: '#ec4899',
    pink: '#ec4899',
  }
  return colorMap[colorName.toLowerCase()] || '#6b7280'
}
