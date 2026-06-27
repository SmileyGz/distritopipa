// components/ProductCard.tsx
// ─────────────────────────────────────────────────────────────
// Single product card on the shelf.
// Shows image, name, price, bundle hint, stock status.
// Click → triggers detail drawer.
// ─────────────────────────────────────────────────────────────

import Image from 'next/image'
import { Product } from './Shelf'

interface ProductCardProps {
  product: Product
  language: 'es' | 'en'
  onClick: () => void
}

export default function ProductCard({ product, language, onClick }: ProductCardProps) {
  const name = language === 'es' ? product.name_es : product.name_en
  const desc = language === 'es' ? product.description_es : product.description_en

  // Format price with commas
  const priceStr = product.price_mxn.toLocaleString('es-MX')

  // Check if there's bundle pricing
  const hasBundle = product.bundle_pricing && product.bundle_pricing.length > 0
  const bundleHint = hasBundle && product.bundle_pricing[0] ? `2 por $${product.bundle_pricing[0].price}` : null

  // Get first image (Sanity URL)
  const imageUrl = product.images?.[0]?.asset?.url

  return (
    <button
      onClick={onClick}
      className={`product-card ${!product.in_stock ? 'out-of-stock' : ''}`}
      aria-label={`${name}, $${priceStr} MXN. Presiona para detalles.`}
    >
      {/* Image */}
      <div className="card-image">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            width={160}
            height={160}
            quality={85}
            sizes="(max-width: 640px) 160px, (max-width: 768px) 180px, 200px"
            style={{ objectFit: 'contain', background: '#1a1a1a' }}
          />
        ) : (
          <div className="no-image">No image</div>
        )}

        {/* Out of stock badge */}
        {!product.in_stock && (
          <div className="oos-badge" aria-label="Out of stock">
            <span>Agotado</span>
          </div>
        )}

        {/* Featured badge */}
        {product.featured && (
          <div className="featured-badge" aria-label="Featured product">
            <span>★</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card-info">
        <h3 className="card-name">{name}</h3>

        {product.size_cm && <p className="card-size">{product.size_cm} cm</p>}

        {product.colors && product.colors.length > 0 && (
          <p className="card-colors">{product.colors.join(', ')}</p>
        )}

        {/* Price */}
        <div className="card-price">
          <span className="price">${priceStr}</span>
          <span className="currency">MXN</span>
        </div>

        {/* Bundle hint */}
        {bundleHint && <p className="card-bundle">{bundleHint}</p>}

        {/* CTA */}
        <div className="card-cta">
          <span className="cta-text">Detalles →</span>
        </div>
      </div>

      <style>{`
        .product-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: #1a1a1a;
          border: 0.5px solid #2a2a2a;
          border-radius: 10px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          font-family: inherit;

          /* Remove default button styling */
          appearance: none;
          -webkit-appearance: none;
          margin: 0;
        }

        .product-card:hover:not(.out-of-stock) {
          border-color: #CC2222;
          background: #262626;
          transform: translateY(-2px);
        }

        .product-card:active:not(.out-of-stock) {
          transform: translateY(0);
        }

        .product-card.out-of-stock {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .product-card:focus-visible {
          outline: 2px solid #CC2222;
          outline-offset: 2px;
        }

        .card-image {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          background: #111;
          border-radius: 6px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-image img {
          width: 100%;
          height: 100%;
        }

        .no-image {
          color: #555;
          font-size: 12px;
        }

        .oos-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.8);
          color: #fff;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          backdrop-filter: blur(4px);
        }

        .featured-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          background: #CC2222;
          color: #fff;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: bold;
        }

        .card-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .card-name {
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          line-height: 1.3;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .card-size,
        .card-colors {
          font-size: 11px;
          color: #888;
          margin: 0;
          line-height: 1.3;
        }

        .card-price {
          display: flex;
          align-items: baseline;
          gap: 3px;
          margin-top: 2px;
        }

        .price {
          font-size: 15px;
          font-weight: 600;
          color: #CC2222;
          letter-spacing: -0.01em;
        }

        .currency {
          font-size: 10px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .card-bundle {
          font-size: 10px;
          color: #555;
          margin: 2px 0 0 0;
          font-style: italic;
        }

        .card-cta {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 0.5px solid #2a2a2a;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cta-text {
          font-size: 11px;
          color: #888;
          font-weight: 500;
          letter-spacing: 0.05em;
          transition: color 0.2s;
        }

        .product-card:hover:not(.out-of-stock) .cta-text {
          color: #CC2222;
        }

        @media (prefers-reduced-motion: reduce) {
          .product-card {
            transition: none;
          }
          .cta-text {
            transition: none;
          }
        }
      `}</style>
    </button>
  )
}
