import Link from 'next/link'
import { supabase, type Product } from '@/lib/supabase'
import { mockProducts } from '@/lib/mockProducts'
import FeaturedCard from '@/components/FeaturedCard'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tu Smoke Shop Local en Cancún | Distrito Pipa',
  description: 'Pipas artesanales, bongs y accesorios de vidrio con entregas rápidas en Cancún. La opción local de confianza en la Región 96 y más.',
  keywords: ['Smoke Shop Local en Cancún', 'Pipas artesanales Cancún', 'Entregas rápidas de accesorios Cancún', 'Accesorios de vidrio Cancún'],
}

type Post = {
  id: string
  author_name: string
  content: string
  upvotes: number
  created_at: string
}

export default async function HomePage() {
  let featured: Product[] = []
  let topPosts: Post[] = []

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co') {
    featured = mockProducts.filter(p => p.featured).slice(0, 8)
  } else {
    const { data, error } = await supabase.from('products').select('*').eq('featured', true).eq('in_stock', true).order('sort_order').limit(8)
    if (!error && data) {
      featured = data as Product[]
    } else if (error) {
      console.error('Supabase fetch failed on home:', error)
    }

    const { data: postsData } = await supabase.from('community_posts').select('id, author_name, content, upvotes, created_at')
      .eq('status', 'approved').is('parent_id', null).order('upvotes', { ascending: false }).limit(3)
    if (postsData) {
      topPosts = postsData as Post[]
    }
  }

  return (
    <div className="home">
      {/* 0. ANNOUNCEMENT BANNER */}
      <div className="vip-banner">
        <span className="vip-title">👑 Únete al Distrito</span>
        <span className="vip-sub">Compra, sube de nivel (Bronce, Plata, Oro) y desbloquea beneficios y envíos gratis.</span>
        <Link href="/catalogo" className="vip-cta">Empezar a sumar →</Link>
      </div>

      {/* 1. NAV (Moved to global layout) */}

      {/* 2. HERO */}
      <section className="hero">
        <div className="hero-inner">
          <p className="hero-tag">Ventaja Cancún · Entregas Rápidas</p>
          <h1 className="hero-title">Tu Smoke Shop<br/>Local en Cancún.</h1>
          <p className="hero-sub">Pipas artesanales, bongs y accesorios de vidrio. Entregas hoy mismo, trato directo y empaque 100% discreto en bolsa kraft.</p>
          <div className="hero-ctas">
            <Link href="/catalogo" className="cta-primary">Ver Catálogo</Link>
            <Link href="#delivery" className="cta-ghost">¿Cómo comprar?</Link>
          </div>
        </div>
        <div className="hero-rule" />
      </section>

      {/* 3. SOCIAL PROOF */}
      <div className="social-proof">
        <div className="sp-bag">📦</div>
        <p className="sp-text"><strong>Más de 120 vecinos</strong> en Cancún ya confían en nosotros. <em>"Llegó en 20 mins a la 96, excelente servicio."</em></p>
      </div>

      {/* 4. CATEGORY GRID (MOVED UP) */}
      <section className="section">
        <div className="section-label">
          <span className="section-eyebrow">Todo el Catálogo</span>
          <span className="section-line" />
        </div>
        <div className="cat-grid">
          {[
            { emoji: '🔴', name: 'Pipas de Vidrio', cat: 'pipes' },
            { emoji: '⚙️', name: 'Accesorios', cat: 'accessories' },
            { emoji: '💧', name: 'Bongs', cat: 'bongs' },
            { emoji: '📜', name: 'Para Forjar', cat: 'rolling' },
          ].map(c => (
            <Link key={c.cat} href={`/catalogo?category=${c.cat}`} className="cat-card">
              <span className="cat-emoji">{c.emoji}</span>
              <span className="cat-name">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 5. FEATURED & BUNDLE */}
      <section className="section">
        <div className="section-label">
          <span className="section-eyebrow">Más Vendidos</span>
          <span className="section-line" />
        </div>
        <div className="carousel-wrap">
          <div className="carousel-track">
            {/* Combo Perfecto */}
            <div className="feat-card combo-card">
              <div className="combo-badge">Combo Perfecto</div>
              <div className="feat-name">Starter Kit Completo</div>
              <div className="feat-meta">Pipa Clásica + Grinder + Encendedor</div>
              <div className="feat-price">$250 MXN</div>
              <Link href="/catalogo" className="feat-cta">Comprar Combo →</Link>
            </div>
            {featured.map(p => <FeaturedCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {/* 6. CROSS-SELL COMPLEMENTOS */}
      <section className="section cross-sell-section">
        <h3 className="cross-sell-title">No olvides tus básicos 👇</h3>
        <div className="cross-sell-row">
          <Link href="/catalogo?category=torches" className="cs-pill">Encendedores 🔥</Link>
          <Link href="/catalogo?category=accessories" className="cs-pill">Filtros / Screens ⚙️</Link>
          <Link href="/catalogo?category=rolling" className="cs-pill">Sábanas 📜</Link>
        </div>
      </section>

      {/* 7. DELIVERY & LOGISTICS */}
      <section className="section" id="delivery">
        <div className="section-label">
          <span className="section-eyebrow">¿Cómo te llega?</span>
          <span className="section-line" />
        </div>
        <div className="delivery-grid">
          <div className="del-card"><span className="del-icon">🏍</span><span className="del-mode">Envío 1–6 km</span><span className="del-price">$50 · noche $80</span></div>
          <div className="del-card"><span className="del-icon">🏍</span><span className="del-mode">Envío 6–10 km</span><span className="del-price">$80 · noche $100</span></div>
          <div className="del-card"><span className="del-icon">📍</span><span className="del-mode">Recoger Local</span><span className="del-price">Región 96 · Gratis</span></div>
          <div className="del-card"><span className="del-icon">📦</span><span className="del-mode">Empaque Discreto</span><span className="del-price">Bolsa Kraft</span></div>
        </div>
        <div className="anticipo-note">
          <span className="anticipo-dot">💳</span>
          <p className="anticipo-text">Asegura tu pieza con un anticipo de solo $50 MXN. Liquida el resto en efectivo al recibir. Fácil y seguro. <Link href="/checkout" className="anticipo-link">Cómo funciona →</Link></p>
        </div>
      </section>

      {/* 8. LOYALTY VIP PERKS */}
      <section className="section vip-perks-section">
        <div className="section-label">
          <span className="section-eyebrow">👑 Únete al Distrito</span>
          <span className="section-line" />
        </div>
        <div className="vip-intro">
          <h2 className="vip-perks-title">Tus compras te suben de nivel</h2>
          <p className="vip-perks-sub">Desbloquea envíos gratis, regalos exclusivos y más.</p>
        </div>

        <div className="vip-tiers-grid">
          {/* BRONCE */}
          <div className="vip-tier-card tier-bronce">
            <div className="tier-header">
              <span className="tier-icon">🥉</span>
              <h3 className="tier-name">Bronce</h3>

            </div>
            <ul className="tier-perks">
              <li><span className="perk-check">✔️</span> <span>Acceso anticipado a restocks y promociones exclusivas.</span></li>
              <li><span className="perk-check">✔️</span> <span>Regalo sorpresa en tu mes de cumpleaños.</span></li>
            </ul>
          </div>

          {/* PLATA */}
          <div className="vip-tier-card tier-plata">
            <div className="tier-header">
              <span className="tier-icon">🥈</span>
              <h3 className="tier-name">Plata</h3>

            </div>
            <ul className="tier-perks">
              <li><span className="perk-check">✔️</span> <span><strong>2 envíos gratis al mes</strong> (horario de 2 a 6 PM).</span></li>
              <li><span className="perk-check">✔️</span> <span>Básicos de regalo en compras mayores a $500.</span></li>
              <li className="tier-includes">Beneficios Bronce incluidos.</li>
            </ul>
          </div>

          {/* ORO */}
          <div className="vip-tier-card tier-oro">
            <div className="tier-header">
              <span className="tier-icon">🥇</span>
              <h3 className="tier-name">Oro</h3>

            </div>
            <ul className="tier-perks">
              <li><span className="perk-check">✔️</span> <span><strong>4 envíos gratis</strong> al mes (incluyendo horario nocturno).</span></li>
              <li><span className="perk-check">✔️</span> <span>Línea directa prioritaria por WhatsApp.</span></li>
              <li><span className="perk-check">✔️</span> <span>10% de descuento permanente.</span></li>
              <li className="tier-includes">Beneficios Plata incluidos.</li>
            </ul>
          </div>
        </div>

        <div className="vip-cta-wrap">
          <Link href="/catalogo" className="cta-primary vip-cta-btn">Empezar a sumar →</Link>
        </div>
      </section>
      {/* 9. COMMUNITY Q&A */}
      <section className="section">
        <div className="section-label">
          <span className="section-eyebrow">¿Primera vez comprando?</span>
          <span className="section-line" />
        </div>
        <div className="community-card">
          <p className="community-title">Preguntas de la comunidad</p>
          <p className="community-sub">Resolvemos tus dudas antes de pedir.</p>
          <div className="questions-list">
            {topPosts.length === 0 ? (
              ['¿Cuánto tarda el envío?', '¿El empaque es discreto?', '¿Cómo pago el anticipo?'].map(q => (
                <Link key={q} href="/comunidad" className="question-item">{q}</Link>
              ))
            ) : topPosts.map(post => (
              <Link key={post.id} href={`/comunidad?post=${post.id}`} className="question-item">
                {post.content.slice(0, 80)}{post.content.length > 80 ? '…' : ''} <span className="q-upvotes">▲ {post.upvotes}</span>
              </Link>
            ))}
          </div>
          <Link href="/comunidad" className="community-cta">Ver más preguntas →</Link>
        </div>
      </section>

      {/* 10. WHOLESALE CTA */}
      <section className="section mayoreo-cta-section">
        <div className="mayoreo-banner">
          <h3>🤝 ¿Quieres iniciar tu negocio?</h3>
          <p>Conoce nuestros precios de mayoreo desde 12 piezas para smoke shops y revendedores.</p>
          <Link href="/mayoreo" className="cta-primary">Ver Planes de Mayoreo</Link>
        </div>
      </section>

      {/* Footer moved to global layout */}

      <style>{styles}</style>
    </div>
  )
}

const styles = `
  .home { min-height: 100vh; background: #111; color: #fff; max-width: 1200px; margin: 0 auto; }
  
  .vip-banner { background: #CC2222; color: #fff; padding: 12px 20px; text-align: center; font-size: 13px; font-weight: 500; display: flex; flex-direction: column; gap: 6px; align-items: center; justify-content: center; }
  .vip-title { font-weight: 700; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; }
  .vip-sub { color: rgba(255, 255, 255, 0.9); font-size: 12px; max-width: 600px; margin: 0 auto; }
  .vip-cta { color: #fff; text-decoration: none; font-weight: 700; background: rgba(0,0,0,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; transition: background 0.2s; }
  .vip-cta:hover { background: rgba(0,0,0,0.4); }
  @media (min-width: 768px) {
    .vip-banner { flex-direction: row; flex-wrap: wrap; gap: 12px; }
  }
    
  .hero { position: relative; padding: 40px 20px; overflow: hidden; display: flex; flex-direction: column; justify-content: center; }
  .hero-tag { font-size: 10px; letter-spacing: .18em; color: #DC143C; text-transform: uppercase; margin-bottom: 12px; font-weight: 600; }
  .hero-title { font-family: var(--font-bebas), sans-serif; font-size: clamp(48px, 12vw, 80px); line-height: 1; margin-bottom: 14px; letter-spacing: 0.02em; }
  .hero-sub { font-size: 15px; color: #888; line-height: 1.6; max-width: 400px; margin-bottom: 28px; }
  .hero-ctas { display: flex; gap: 10px; flex-wrap: wrap; }
  .hero-rule { width: 100%; height: 1px; background: linear-gradient(to right, #DC143C, transparent); margin-top: 36px; }

  .cta-primary { display: inline-flex; padding: 13px 22px; background: #DC143C; color: #fff; border-radius: 6px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; text-decoration: none; transition: all 0.2s ease-out; }
  .cta-primary:hover { background: #b81032; box-shadow: 0 4px 20px rgba(220, 20, 60, 0.2); transform: translateY(-2px); }
  .cta-ghost { padding: 13px 20px; background: transparent; color: #ccc; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease-out; }
  .cta-ghost:hover { background: rgba(26,26,26,0.6); border-color: #DC143C; color: #fff; box-shadow: 0 4px 20px rgba(220, 20, 60, 0.15); transform: translateY(-2px); }

  .social-proof { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 14px 20px; background: #0d0d0d; border-top: 0.5px solid #1a1a1a; border-bottom: 0.5px solid #1a1a1a; }
  .sp-bag { font-size: 24px; }
  .sp-text { font-size: 12px; color: #888; line-height: 1.4; }
  .sp-text strong { color: #fff; }

  .section { padding: 32px 20px; }
  .section-label { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .section-eyebrow { font-family: var(--font-bebas), sans-serif; font-size: 24px; color: #fff; letter-spacing: 0.05em; white-space: nowrap; text-transform: uppercase; }
  .section-line { flex: 1; height: 2px; background: #DC143C; }

  /* GLASSMORPHISM Y HOVERS ESTANDARIZADOS */
  .cat-card, .feat-card, .del-card, .anticipo-note, .community-card, .mayoreo-banner, .question-item {
    background: rgba(26, 26, 26, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }
  .cat-card, .feat-card, .question-item, .mayoreo-banner { transition: all 0.2s ease-out; cursor: pointer; }
  .cat-card:hover, .feat-card:hover, .question-item:hover, .mayoreo-banner:hover {
    border-color: #DC143C;
    box-shadow: 0 4px 20px rgba(220, 20, 60, 0.15);
    transform: translateY(-4px);
  }

  .cat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .cat-card { padding: 16px; text-decoration: none; color: #fff; display: flex; flex-direction: column; gap: 6px; }
  .cat-emoji { font-size: 24px; }
  .cat-name { font-size: 14px; font-weight: 500; }

  .carousel-wrap { overflow-x: auto; margin: 0 -20px; padding: 0 20px; -webkit-overflow-scrolling: touch; }
  .carousel-wrap::-webkit-scrollbar { display: none; }
  .carousel-track { display: flex; gap: 12px; padding-bottom: 12px; min-width: min-content; }

  .feat-card { flex-shrink: 0; width: 160px; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
  .feat-img { width: 100%; aspect-ratio: 1; background: #111; border-radius: 8px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; margin-bottom: 8px; }
  .feat-img img { width: 100%; height: 100%; object-fit: contain; }
  .feat-placeholder { font-size: 32px; }
  .feat-star { position: absolute; top: 6px; left: 6px; background: #DC143C; color: #fff; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }
  .feat-name { font-size: 13px; font-weight: 600; line-height: 1.3; margin-top: 4px; color: #fff; text-decoration: none; }
  .feat-meta { font-size: 11px; color: #888; }
  .feat-price { font-size: 16px; font-weight: 600; color: #DC143C; margin-bottom: 6px; }
  
  .feat-cta-btn { background: #222; color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 8px; text-align: center; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 6px; cursor: pointer; transition: all 0.2s ease-out; width: 100%; margin-top: auto; }
  .feat-cta-btn:hover { background: #DC143C; border-color: #DC143C; box-shadow: 0 4px 15px rgba(220, 20, 60, 0.2); }

  .combo-card { border-color: #DC143C; background: rgba(220,20,60,0.05); justify-content: space-between; text-decoration: none; display: flex; }
  .combo-badge { background: #DC143C; color: #fff; font-size: 10px; font-weight: 700; text-align: center; padding: 4px; border-radius: 4px; margin-bottom: 8px; text-transform: uppercase; }
  .combo-card .feat-name { font-size: 15px; color: #DC143C; }

  .cross-sell-section { padding-top: 0; }
  .cross-sell-title { font-size: 13px; color: #888; margin-bottom: 12px; font-weight: 500; }
  .cross-sell-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .cs-pill { padding: 8px 16px; background: rgba(26,26,26,0.6); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #ccc; text-decoration: none; transition: all 0.2s ease-out; }
  .cs-pill:hover { border-color: #DC143C; color: #fff; box-shadow: 0 4px 15px rgba(220, 20, 60, 0.15); transform: translateY(-2px); }

  .delivery-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .del-card { padding: 14px 10px; text-align: center; display: flex; flex-direction: column; gap: 4px; }
  .del-icon { font-size: 24px; }
  .del-mode { font-size: 12px; font-weight: 600; color: #fff; }
  .del-price { font-size: 11px; color: #888; }
  .anticipo-note { padding: 16px; display: flex; align-items: flex-start; gap: 12px; }
  .anticipo-dot { font-size: 20px; }
  .anticipo-text { font-size: 13px; color: #aaa; line-height: 1.5; }
  .anticipo-link { color: #DC143C; text-decoration: none; font-weight: 500; }

  .loyalty-teaser { padding: 0 20px; }
  .loyalty-inner { background: linear-gradient(135deg, #1a1a1a, #2a1a1a); border: 0.5px solid #DC143C; border-radius: 12px; padding: 24px; text-align: center; }
  .loyalty-inner h3 { font-family: var(--font-bebas), sans-serif; font-size: 24px; margin-bottom: 8px; color: #fff; letter-spacing: 0.05em; text-transform: uppercase; }
  .loyalty-inner p { font-size: 13px; color: #ccc; margin-bottom: 16px; line-height: 1.5; }

  .community-card { padding: 20px; }
  .community-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
  .community-sub { font-size: 13px; color: #888; margin-bottom: 16px; }
  .questions-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
  .question-item { padding: 12px 14px; font-size: 13px; color: #ccc; text-decoration: none; display: flex; justify-content: space-between; align-items: center; border-radius: 6px !important; }
  .q-upvotes { font-size: 11px; color: #555; }
  .community-cta { display: block; text-align: center; padding: 12px; color: #DC143C; border: 1px solid rgba(220,20,60,0.3); border-radius: 6px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; text-decoration: none; transition: all 0.2s ease-out; }
  .community-cta:hover { background: rgba(220,20,60,0.1); border-color: #DC143C; }

  .mayoreo-cta-section { padding-bottom: 60px; }
  .mayoreo-banner { border-style: dashed !important; padding: 24px; text-align: center; text-decoration: none; display: block; }
  .mayoreo-banner h3 { font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #fff; }
  .mayoreo-banner p { font-size: 13px; color: #888; margin-bottom: 16px; line-height: 1.5; max-width: 300px; margin-inline: auto; }

  /* VIP PERKS GLASSMORPHISM */
  .vip-perks-section { margin-top: 20px; }
  .vip-intro { text-align: center; margin-bottom: 30px; }
  .vip-perks-title { font-family: var(--font-bebas), sans-serif; font-size: 36px; line-height: 1.1; margin-bottom: 8px; letter-spacing: 0.02em; }
  .vip-perks-sub { color: #888; font-size: 14px; max-width: 400px; margin: 0 auto; }
  
  .vip-tiers-grid { display: grid; gap: 20px; grid-template-columns: 1fr; margin-bottom: 30px; }
  @media (min-width: 768px) { .vip-tiers-grid { grid-template-columns: repeat(3, 1fr); } }
  
  .vip-tier-card { 
    background: rgba(255, 255, 255, 0.03); 
    backdrop-filter: blur(10px); 
    -webkit-backdrop-filter: blur(10px);
    border-radius: 12px; 
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .vip-tier-card:hover { transform: translateY(-4px); }
  
  .tier-bronce { border-top: 3px solid #cd7f32; }
  .tier-plata { border-top: 3px solid #c0c0c0; }
  .tier-oro { 
    border-top: 3px solid #ffd700; 
    background: linear-gradient(180deg, rgba(255, 215, 0, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
    box-shadow: 0 8px 32px rgba(255, 215, 0, 0.05);
  }
  
  .tier-header { text-align: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .tier-icon { font-size: 20px; display: block; margin-bottom: 4px; }
  .tier-name { font-size: 16px; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.05em; text-transform: uppercase; }
  .tier-bronce .tier-name { color: #cd7f32; }
  .tier-plata .tier-name { color: #c0c0c0; }
  .tier-oro .tier-name { color: #ffd700; }
  .tier-req { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  
  .tier-perks { list-style: none; padding: 0; margin: 0; font-size: 13px; color: #ddd; line-height: 1.4; display: flex; flex-direction: column; gap: 8px; }
  .tier-perks li { display: flex; gap: 8px; align-items: flex-start; }
  .perk-check { flex-shrink: 0; font-size: 11px; margin-top: 2px; }
  .tier-perks li span:not(.perk-check) { flex: 1; }
  .tier-perks li strong { color: #fff; }
  .tier-includes { font-size: 11px; color: #888; font-style: italic; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px; }
  
  .vip-cta-wrap { text-align: center; margin-top: 10px; }
  .vip-cta-btn { display: inline-block; padding: 14px 32px; font-size: 15px; }

  @media (min-width: 768px) {
    .hero { padding: 80px 40px; }
    .hero-title { font-size: 100px; }
    .hero-sub { font-size: 18px; max-width: 500px; }
    .section { padding: 40px; }
    .cat-grid, .delivery-grid { grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .community-card, .mayoreo-banner { max-width: 800px; margin: 0 auto; }
    .sp-text { font-size: 15px; }
    .vip-tier-card { padding: 24px; }
    .tier-icon { font-size: 32px; }
    .tier-name { font-size: 20px; }
    .tier-header { margin-bottom: 24px; padding-bottom: 20px; }
  }
`
