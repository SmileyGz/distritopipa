'use client'
// app/(home)/page.tsx
// ─────────────────────────────────────────────────────────────
// Distrito Pipa — Home page
// Mobile-first. Sections:
//   1. Nav (sticky, blur)
//   2. Hero (brand statement + CTAs)
//   3. Social proof bar
//   4. Featured products carousel (from Supabase, featured=true)
//   5. Delivery options
//   6. Category grid → shelf
//   7. Community teaser (top Q&A posts)
//   8. Age + legal footer
//
// Commercial Director notes baked in:
//   - Hero CTA goes to /menu (shelf) not WhatsApp — browse first, buy second
//   - "¿Cómo comprar?" anchors to delivery section (removes friction)
//   - Social proof bar is sticky above the fold trust signal
//   - Category grid gives quick navigation for returning customers
//   - Community teaser drives SEO + return visits
//   - Bundle pricing visible on cards (drives higher ticket)
// ─────────────────────────────────────────────────────────────

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { supabase, getImageUrl, type Product } from '@/lib/supabase'

type Post = {
  id: string
  author_name: string
  content: string
  upvotes: number
  created_at: string
}

export default function HomePage() {
  const [featured, setFeatured]   = useState<Product[]>([])
  const [topPosts, setTopPosts]   = useState<Post[]>([])
  const [navScrolled, setNavScrolled] = useState(false)
  const deliveryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Featured products
    supabase
      .from('products')
      .select('*')
      .eq('featured', true)
      .eq('in_stock', true)
      .order('sort_order')
      .limit(8)
      .then(({ data }) => { if (data) setFeatured(data as Product[]) })

    // Top community posts
    supabase
      .from('community_posts')
      .select('id, author_name, content, upvotes, created_at')
      .eq('status', 'approved')
      .is('parent_id', null)
      .order('upvotes', { ascending: false })
      .limit(3)
      .then(({ data }) => { if (data) setTopPosts(data as Post[]) })

    // Scroll listener for nav
    const onScroll = () => setNavScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToDelivery = () => {
    deliveryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="home">

      {/* ── 1. NAV ───────────────────────────────────────────── */}
      <nav className={`dp-nav ${navScrolled ? 'scrolled' : ''}`} aria-label="Navegación principal">
        <div className="nav-logo">
          <span className="nav-eyebrow">Distrito</span>
          <span className="nav-brand">Pipa</span>
          <span className="nav-city">Cancún</span>
        </div>
        <div className="nav-links">
          <Link href="/menu" className="nav-link">Menú</Link>
          <Link href="/comunidad" className="nav-link">Q&A</Link>
          <Link href="/menu" className="nav-cta" aria-label="Ordenar ahora">
            Ordenar
          </Link>
        </div>
      </nav>

      {/* ── 2. HERO ──────────────────────────────────────────── */}
      <section className="hero" aria-label="Hero">
        {/* Decorative bolts — brand signature */}
        <BoltSVG className="bolt-left" />
        <BoltSVG className="bolt-right" flip />

        <div className="hero-inner">
          <p className="hero-tag">Accesorios de uso personal · Cancún</p>
          <h1 className="hero-title">
            El <em>Distrito</em><br/>te espera.
          </h1>
          <p className="hero-sub">
            Pipas, grinders, bongs y más. Envío a domicilio mismo día en Cancún.
            Todo 100% legal.
          </p>
          <div className="hero-ctas">
            <Link href="/menu" className="cta-primary">Ver el estante</Link>
            <button className="cta-ghost" onClick={scrollToDelivery}>
              ¿Cómo comprar?
            </button>
          </div>
        </div>
        <div className="hero-rule" aria-hidden="true" />
      </section>

      {/* ── 3. SOCIAL PROOF ──────────────────────────────────── */}
      <div className="social-proof" aria-label="Clientes">
        <div className="sp-avatars" aria-hidden="true">
          <div className="sp-av" style={{ background: '#2a1a1a', color: '#CC2222' }}>C</div>
          <div className="sp-av" style={{ background: '#1a2a1a', color: '#4ade80' }}>S</div>
          <div className="sp-av" style={{ background: '#1a1a2a', color: '#60a5fa' }}>L</div>
        </div>
        <p className="sp-text">
          <strong>+120 clientes</strong> en Cancún ya compraron.{' '}
          Envíos el mismo día.
        </p>
      </div>

      {/* ── 4. FEATURED CAROUSEL ─────────────────────────────── */}
      <section className="section" aria-label="Productos destacados">
        <div className="section-label">
          <span className="section-eyebrow">Más vendidos</span>
          <span className="section-line" aria-hidden="true" />
        </div>

        <div className="carousel-wrap">
          <div className="carousel-track" role="list" aria-label="Productos más vendidos">
            {featured.map(p => (
              <FeaturedCard key={p.id} product={p} />
            ))}
            {/* See all card */}
            <Link href="/menu" className="see-all-card" aria-label="Ver todos los productos">
              <span className="see-all-icon">→</span>
              <span className="see-all-label">Ver todo</span>
            </Link>
          </div>
        </div>
      </section>

      <div className="dp-divider" aria-hidden="true" />

      {/* ── 5. DELIVERY ──────────────────────────────────────── */}
      <section className="section" aria-label="Opciones de entrega" ref={deliveryRef}>
        <div className="section-label">
          <span className="section-eyebrow">¿Cómo recibes?</span>
          <span className="section-line" aria-hidden="true" />
        </div>

        <div className="delivery-grid">
          {[
            { icon: '🏍', mode: 'Envío 1–6 km',    price: '$50 · noche $80'  },
            { icon: '🏍', mode: 'Envío 6–10 km',   price: '$80 · noche $100' },
            { icon: '📍', mode: 'Recoger en tienda',price: 'Región 96 · gratis'},
            { icon: '🏢', mode: 'Punto medio',      price: '$40 · plaza'      },
          ].map(d => (
            <div key={d.mode} className="del-card">
              <span className="del-icon" aria-hidden="true">{d.icon}</span>
              <span className="del-mode">{d.mode}</span>
              <span className="del-price">{d.price}</span>
            </div>
          ))}
        </div>

        <div className="anticipo-note">
          <span className="anticipo-dot" aria-hidden="true">💳</span>
          <p className="anticipo-text">
            Se solicita anticipo para confirmar el pedido. El resto se paga en efectivo
            al recibir.{' '}
            <Link href="/booking" className="anticipo-link">Cómo funciona →</Link>
          </p>
        </div>
      </section>

      <div className="dp-divider" aria-hidden="true" />

      {/* ── 6. CATEGORY GRID ─────────────────────────────────── */}
      <section className="section" aria-label="Categorías">
        <div className="section-label">
          <span className="section-eyebrow">Todo el catálogo</span>
          <span className="section-line" aria-hidden="true" />
        </div>

        <div className="cat-grid">
          {[
            { emoji: '🔴', name: 'Pipes',           sub: '5 modelos · desde $49',  cat: 'pipes'       },
            { emoji: '⚙️', name: 'Accessories',     sub: '3 productos · desde $119', cat: 'accessories' },
            { emoji: '💧', name: 'Bongs',            sub: '2 modelos · desde $420', cat: 'bongs'       },
            { emoji: '📜', name: 'Rolling + Torches',sub: '5 productos · desde $10',cat: 'rolling'     },
          ].map(c => (
            <Link key={c.cat} href={`/menu?category=${c.cat}`} className="cat-card">
              <span className="cat-emoji" aria-hidden="true">{c.emoji}</span>
              <span className="cat-name">{c.name}</span>
              <span className="cat-sub">{c.sub}</span>
            </Link>
          ))}
        </div>

        <Link href="/menu" className="cta-primary full-width">
          Ver todo el estante →
        </Link>
      </section>

      <div className="dp-divider" aria-hidden="true" />

      {/* ── 7. COMMUNITY ─────────────────────────────────────── */}
      <section className="section" aria-label="Comunidad">
        <div className="section-label">
          <span className="section-eyebrow">Comunidad</span>
          <span className="section-line" aria-hidden="true" />
        </div>

        <div className="community-card">
          <p className="community-title">Preguntas frecuentes</p>
          <p className="community-sub">Resuelve dudas antes de comprar.</p>

          <div className="questions-list" role="list">
            {topPosts.length === 0 ? (
              // Fallback hardcoded until community has posts
              [
                '¿Cuánto tarda un envío nocturno?',
                '¿Cómo limpio una pipa de vidrio?',
                '¿Cuál es la diferencia entre Reforzada y Colores?',
              ].map(q => (
                <Link key={q} href="/comunidad" className="question-item" role="listitem">
                  {q}
                </Link>
              ))
            ) : (
              topPosts.map(post => (
                <Link key={post.id} href={`/comunidad?post=${post.id}`}
                  className="question-item" role="listitem">
                  {post.content.slice(0, 80)}{post.content.length > 80 ? '…' : ''}
                  <span className="q-upvotes">▲ {post.upvotes}</span>
                </Link>
              ))
            )}
          </div>

          <Link href="/comunidad" className="community-cta">
            Ver todas las preguntas →
          </Link>
        </div>
      </section>

      {/* ── 8. FOOTER ────────────────────────────────────────── */}
      <footer className="dp-footer" aria-label="Pie de página">
        <p className="footer-age">Solo mayores de 18 años</p>
        <p className="footer-legal">
          Accesorios de uso personal · Producto legal · No incluye sustancias
        </p>
        <p className="footer-address">
          Distrito Pipa · Región 96, Cancún
        </p>
        <Link href="/aviso-de-privacidad" className="footer-link">
          Aviso de privacidad
        </Link>
      </footer>

      <style>{styles}</style>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────

function BoltSVG({ className, flip }: { className: string; flip?: boolean }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 60 120"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
    >
      <polygon points="36,0 15,52 30,52 24,120 45,45 28.5,45" fill="#CC2222" />
    </svg>
  )
}

function FeaturedCard({ product }: { product: Product }) {
  const name  = product.name_es
  const price = product.price_mxn
  const imageUrl = product.image_paths?.[0] ? getImageUrl(product.image_paths[0]) : null
  const bundle = product.bundle_pricing?.[0]

  return (
    <Link
      href={`/menu?product=${product.slug}`}
      className="feat-card"
      role="listitem"
      aria-label={`${name} — $${price} MXN`}
    >
      <div className="feat-img">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} />
        ) : (
          <span className="feat-placeholder">📦</span>
        )}
        <span className="feat-star" aria-label="Destacado">★</span>
      </div>
      <div className="feat-name">{name}</div>
      {product.size_cm && <div className="feat-meta">{product.size_cm} cm</div>}
      <div className="feat-price">${price}</div>
      {bundle && <div className="feat-bundle">{bundle.qty}x ${bundle.price}</div>}
      <div className="feat-cta">Ver →</div>
    </Link>
  )
}

// ─── Styles ────────────────────────────────────────────────────
const styles = `
  .home {
    min-height: 100vh;
    background: #111;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    max-width: 480px;
    margin: 0 auto;
  }

  /* NAV */
  .dp-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(17,17,17,0.85);
    backdrop-filter: blur(12px);
    border-bottom: 0.5px solid transparent;
    transition: border-color 0.2s;
  }
  .dp-nav.scrolled { border-bottom-color: #2a2a2a; }
  .nav-logo { display: flex; flex-direction: column; line-height: 1; }
  .nav-eyebrow { font-size: 9px; letter-spacing: .2em; color: #888; text-transform: uppercase; }
  .nav-brand {
    font-family: 'Playfair Display', Georgia, serif;
    font-style: italic;
    font-size: 22px;
    color: #fff;
    line-height: 1;
  }
  .nav-city { font-size: 8px; letter-spacing: .25em; color: #CC2222; text-transform: uppercase; }
  .nav-links { display: flex; align-items: center; gap: 12px; }
  .nav-link { font-size: 13px; color: #888; text-decoration: none; transition: color .15s; }
  .nav-link:hover { color: #fff; }
  .nav-cta {
    padding: 7px 16px;
    background: #CC2222;
    color: #fff;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    transition: background .15s;
  }
  .nav-cta:hover { background: #e02222; }

  /* HERO */
  .hero {
    position: relative;
    padding: 44px 20px 36px;
    overflow: hidden;
    min-height: 340px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .bolt-left, .bolt-right {
    position: absolute;
    width: 64px;
    opacity: 0.16;
    animation: boltPulse 3s ease-in-out infinite;
  }
  .bolt-left  { left: -14px; top: 24px; }
  .bolt-right { right: -14px; bottom: 32px; animation-delay: 1.5s; }
  @keyframes boltPulse { 0%,100%{opacity:0.1} 50%{opacity:0.28} }

  .hero-inner { position: relative; z-index: 1; }
  .hero-tag {
    font-size: 10px;
    letter-spacing: .18em;
    color: #CC2222;
    text-transform: uppercase;
    margin-bottom: 12px;
    font-weight: 500;
  }
  .hero-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-style: italic;
    font-size: clamp(42px, 12vw, 56px);
    line-height: 1.05;
    color: #fff;
    margin-bottom: 14px;
    letter-spacing: -0.01em;
  }
  .hero-title em { color: #CC2222; font-style: inherit; }
  .hero-sub {
    font-size: 14px;
    color: #888;
    line-height: 1.65;
    max-width: 300px;
    margin-bottom: 28px;
  }
  .hero-ctas { display: flex; gap: 10px; flex-wrap: wrap; }
  .hero-rule {
    width: 100%;
    height: 1px;
    background: linear-gradient(to right, #CC2222, transparent);
    margin-top: 36px;
  }

  /* Shared CTAs */
  .cta-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 13px 22px;
    background: #CC2222;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: background .15s, transform .1s;
    letter-spacing: .02em;
  }
  .cta-primary:hover { background: #e02222; }
  .cta-primary:active { transform: scale(0.98); }
  .cta-primary.full-width { width: 100%; margin-top: 12px; }

  .cta-ghost {
    padding: 13px 20px;
    background: transparent;
    color: #888;
    border: 0.5px solid #2a2a2a;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all .15s;
  }
  .cta-ghost:hover { color: #fff; border-color: #555; }

  /* SOCIAL PROOF */
  .social-proof {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    background: #0d0d0d;
    border-top: 0.5px solid #1a1a1a;
    border-bottom: 0.5px solid #1a1a1a;
  }
  .sp-avatars { display: flex; }
  .sp-av {
    width: 30px; height: 30px;
    border-radius: 50%;
    border: 2px solid #111;
    margin-right: -9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 600;
  }
  .sp-text { font-size: 12px; color: #888; line-height: 1.4; margin-left: 4px; }
  .sp-text strong { color: #fff; }

  /* SECTIONS */
  .section { padding: 28px 20px; }
  .section-label {
    display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
  }
  .section-eyebrow {
    font-family: 'Playfair Display', Georgia, serif;
    font-style: italic;
    font-size: 14px;
    color: #fff;
    white-space: nowrap;
    font-weight: 700;
  }
  .section-line {
    flex: 1; height: 1px;
    background: linear-gradient(to right, #CC2222, transparent);
  }

  /* CAROUSEL */
  .carousel-wrap {
    overflow-x: auto;
    overflow-y: hidden;
    margin: 0 -20px;
    padding: 0 20px;
    -webkit-overflow-scrolling: touch;
  }
  .carousel-wrap::-webkit-scrollbar { display: none; }
  .carousel-track {
    display: flex; gap: 10px;
    padding-bottom: 8px;
    min-width: min-content;
  }

  /* FEATURED CARD */
  .feat-card {
    flex-shrink: 0;
    width: 148px;
    background: #1a1a1a;
    border: 0.5px solid #2a2a2a;
    border-radius: 10px;
    padding: 11px;
    cursor: pointer;
    text-decoration: none;
    color: #fff;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: border-color .15s, transform .15s;
  }
  .feat-card:hover { border-color: #CC2222; transform: translateY(-2px); }
  .feat-img {
    width: 100%; aspect-ratio: 1;
    background: #111;
    border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden; margin-bottom: 6px;
  }
  .feat-img img { width: 100%; height: 100%; object-fit: contain; }
  .feat-placeholder { font-size: 32px; }
  .feat-star {
    position: absolute; top: 6px; left: 6px;
    background: #CC2222; color: #fff;
    width: 18px; height: 18px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700;
  }
  .feat-name { font-size: 12px; font-weight: 500; line-height: 1.3; }
  .feat-meta { font-size: 10px; color: #888; }
  .feat-price { font-size: 15px; font-weight: 600; color: #CC2222; }
  .feat-bundle { font-size: 10px; color: #555; font-style: italic; }
  .feat-cta {
    font-size: 10px; color: #555;
    border-top: 0.5px solid #2a2a2a;
    padding-top: 6px; text-align: center;
    margin-top: 4px;
    transition: color .15s;
  }
  .feat-card:hover .feat-cta { color: #CC2222; }

  /* See-all card */
  .see-all-card {
    flex-shrink: 0;
    width: 148px;
    background: #1a1a1a;
    border: 0.5px solid #2a2a2a;
    border-radius: 10px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 8px;
    text-decoration: none;
    color: #888;
    transition: all .15s;
    min-height: 200px;
  }
  .see-all-card:hover { border-color: #CC2222; color: #CC2222; }
  .see-all-icon { font-size: 24px; }
  .see-all-label { font-size: 12px; font-weight: 500; }

  /* DELIVERY */
  .delivery-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;
  }
  .del-card {
    background: #1a1a1a; border: 0.5px solid #2a2a2a; border-radius: 9px;
    padding: 13px 10px; text-align: center;
    display: flex; flex-direction: column; gap: 4px;
  }
  .del-icon { font-size: 20px; }
  .del-mode { font-size: 12px; font-weight: 500; color: #fff; }
  .del-price { font-size: 11px; color: #888; }

  .anticipo-note {
    background: #1a1a1a; border: 0.5px solid #2a2a2a; border-radius: 8px;
    padding: 12px 14px; display: flex; align-items: flex-start; gap: 10px;
  }
  .anticipo-dot { font-size: 18px; flex-shrink: 0; }
  .anticipo-text { font-size: 12px; color: #888; line-height: 1.55; }
  .anticipo-link { color: #CC2222; text-decoration: none; font-weight: 500; }

  /* CATEGORIES */
  .cat-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 0;
  }
  .cat-card {
    background: #1a1a1a; border: 0.5px solid #2a2a2a; border-radius: 9px;
    padding: 14px 12px; text-decoration: none; color: #fff;
    display: flex; flex-direction: column; gap: 4px;
    transition: border-color .15s;
  }
  .cat-card:hover { border-color: #CC2222; }
  .cat-emoji { font-size: 20px; }
  .cat-name { font-size: 13px; font-weight: 500; }
  .cat-sub { font-size: 10px; color: #888; }

  /* COMMUNITY */
  .community-card {
    background: #1a1a1a; border: 0.5px solid #2a2a2a; border-radius: 12px; padding: 18px;
  }
  .community-title { font-size: 14px; font-weight: 600; margin-bottom: 5px; }
  .community-sub { font-size: 12px; color: #888; margin-bottom: 14px; line-height: 1.5; }
  .questions-list { display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px; }
  .question-item {
    background: #111; border: 0.5px solid #2a2a2a; border-radius: 7px;
    padding: 10px 12px; font-size: 12px; color: #ccc;
    text-decoration: none; display: flex; justify-content: space-between; align-items: center;
    gap: 8px; transition: border-color .15s;
    line-height: 1.4;
  }
  .question-item:hover { border-color: #CC2222; color: #fff; }
  .q-upvotes { font-size: 10px; color: #555; white-space: nowrap; }
  .community-cta {
    display: block; text-align: center; padding: 10px;
    background: transparent; color: #CC2222;
    border: 0.5px solid #CC222244; border-radius: 7px;
    font-size: 12px; font-weight: 500; text-decoration: none;
    transition: all .15s;
  }
  .community-cta:hover { background: rgba(204,34,34,.08); border-color: #CC2222; }

  /* FOOTER */
  .dp-footer {
    padding: 20px; text-align: center;
    border-top: 0.5px solid #1a1a1a;
    display: flex; flex-direction: column; gap: 6px;
  }
  .footer-age { font-size: 11px; color: #555; }
  .footer-legal { font-size: 10px; color: #444; line-height: 1.6; }
  .footer-address { font-size: 10px; color: #444; }
  .footer-link { font-size: 10px; color: #555; text-decoration: underline; }

  .dp-divider { height: 0.5px; background: #1a1a1a; margin: 0 20px; }

  @media (prefers-reduced-motion: reduce) {
    .bolt-left, .bolt-right { animation: none; }
    .feat-card, .cat-card { transition: none; }
  }
`
