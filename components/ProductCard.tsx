// components/ProductCard.tsx
import Image from 'next/image'
import { Product } from '@/lib/supabase'

interface ProductCardProps {
  product: Product
  language: 'es' | 'en'
  imageUrl: string | null
  onClick?: () => void
}

export default function ProductCard({ product, language, imageUrl, onClick }: ProductCardProps) {
  const name = (language === 'es' ? product.name_es : product.name_en) || 'Producto'
  const priceStr = product.price_mxn.toLocaleString('es-MX')

  // Check if there's bundle pricing
  const hasBundle = product.bundle_pricing && product.bundle_pricing.length > 0
  const bundleHint = hasBundle && product.bundle_pricing[0] ? `${product.bundle_pricing[0].qty} x $${product.bundle_pricing[0].price}` : null

  return (
    <div
      onClick={onClick}
      className={`poster-product-card ${!product.in_stock ? 'out-of-stock' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${name}, $${priceStr} MXN`}
    >
      <div className="card-image-wrap">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            width={140}
            height={140}
            quality={85}
            unoptimized={true}
            style={{ objectFit: 'contain', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.5))' }}
          />
        ) : (
          <div className="no-image">No image</div>
        )}

        {/* Pricing Sticker */}
        <div className="price-sticker">
          <div className="price-main">${priceStr}</div>
          {bundleHint && (
            <div className="price-bundle">
              <span className="bundle-tag">{bundleHint}</span>
            </div>
          )}
        </div>

        {/* Out of stock badge */}
        {!product.in_stock && (
          <div className="oos-sticker">
            <span>AGOTADO</span>
          </div>
        )}
      </div>

      <div className="card-info">
        <h3 className="card-name">{name}</h3>
        {product.size_cm && <p className="card-size">{product.size_cm} cm</p>}
      </div>

      <style>{`
        .poster-product-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-decoration: none;
          color: #fff;
          width: 140px;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          position: relative;
        }

        .poster-product-card:hover:not(.out-of-stock) {
          transform: scale(1.1) translateY(-10px);
          z-index: 50;
        }

        .poster-product-card.out-of-stock {
          opacity: 0.5;
          filter: grayscale(1);
          cursor: not-allowed;
        }

        .card-image-wrap {
          position: relative;
          width: 100%;
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }

          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5));
        }

        /* Pricing Sticker */
        .price-sticker {
          position: absolute;
          top: -8px;
          right: -8px;
          background: #DC143C; /* Rojo Eléctrico */
          color: #fff;
          padding: 6px 10px;
          border-radius: 6px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.8);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          z-index: 10;
          transition: transform 0.2s;
        }
        
        .poster-product-card:hover .price-sticker {
          transform: scale(1.05) translateY(-2px);
        }

        .price-main {
          font-family: var(--font-bebas), sans-serif;
          font-size: 24px;
          line-height: 1;
          letter-spacing: 0.05em;
        }

        .price-bundle {
          background: #111;
          color: #fff;
          font-family: var(--font-inter), sans-serif;
          font-size: 11px;
          font-weight: 800;
          padding: 3px 6px;
          border-radius: 20px;
          white-space: nowrap;
        }

        .oos-sticker {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-family: var(--font-bebas), sans-serif;
          font-size: 20px;
          letter-spacing: 0.1em;
          border-radius: 8px;
          backdrop-filter: blur(2px);
          z-index: 20;
        }

        .card-info {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .card-name {
          font-family: var(--font-bebas), sans-serif;
          font-size: 22px;
          color: #fff;
          line-height: 1;
          letter-spacing: 0.05em;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
          margin: 0;
        }

        .card-size {
          font-family: var(--font-inter), sans-serif;
          font-size: 11px;
          color: #aaa;
          font-weight: 600;
          margin: 0;
        }

        @media (min-width: 640px) {
          .poster-product-card { width: 160px; }
          .card-image-wrap { height: 160px; }
          .price-main { font-size: 28px; }
          .card-name { font-size: 26px; }
        }
      `}</style>
    </div>
  )
}
