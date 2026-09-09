import { Metadata } from 'next'
import Link from 'next/link'
import { getSortedPostsData } from '../../lib/markdown'

export const metadata: Metadata = {
  title: 'Blog | Distrito Pipa Cancún',
  description: 'Artículos, guías y contenido local sobre accesorios de cristal y entregas en Cancún.',
  keywords: ['Blog smoke shop Cancún', 'Distrito Pipa blog', 'Pipas de cristal Cancún']
}

export default function CulturaPage() {
  const allPostsData = getSortedPostsData()

  return (
    <main className="cultura-page">
      {/* Schema Markup for Blog Collection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Blog | Distrito Pipa Cancún",
            "description": "Artículos, guías y contenido local sobre accesorios de cristal y entregas en Cancún.",
            "url": "https://distritopipa.com/blog",
            "hasPart": allPostsData.map(post => ({
              "@type": "BlogPosting",
              "headline": post.title,
              "description": post.meta_description,
              "url": `https://distritopipa.com/blog/${post.slug}`
            }))
          })
        }}
      />

      <div className="cultura-container">
        
        <header className="cultura-header">
          <h1>Blog</h1>
          <p>Artículos, guías y contenido local de Cancún.</p>
        </header>

        <div className="articles-grid">
          {allPostsData.map(({ slug, title, meta_description }) => (
            <article key={slug} className="article-card">
              <div className="article-img-placeholder">
                <div className="digital-sticker">
                  <span>DP</span>
                </div>
              </div>
              <div className="article-content">
                <span className="article-tag">Blog</span>
                <h2>{title}</h2>
                <p>{meta_description}</p>
                <div className="intent-snippet">⚡️ Guía rápida local. Tiempo de lectura: 2 min.</div>
                <Link href={`/blog/${slug}`} className="mt-auto">
                  <button className="read-more">[ LEER ARTÍCULO ]</button>
                </Link>
              </div>
            </article>
          ))}
        </div>

      </div>

      <style>{`
        .cultura-page {
          min-height: 100vh;
          background-color: #111;
          padding: 40px 20px;
          color: #fff;
        }

        .cultura-container {
          max-width: 1000px;
          margin: 0 auto;
        }

        .cultura-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .cultura-header h1 {
          font-family: var(--font-bebas), sans-serif;
          font-size: clamp(40px, 8vw, 64px);
          margin-bottom: 8px;
          letter-spacing: 0.05em;
        }

        .cultura-header p {
          color: #888;
          font-size: 16px;
        }

        .articles-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }

        @media (min-width: 768px) {
          .articles-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .article-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          overflow: hidden;
          transition: transform 0.2s, border-color 0.2s;
          display: flex;
          flex-direction: column;
        }

        .article-card:hover {
          transform: translateY(-4px);
          border-color: #DC143C;
          background: #DC143C;
        }
        
        .article-card:hover h2,
        .article-card:hover p,
        .article-card:hover .intent-snippet {
          color: #fff !important;
        }
        
        .article-card:hover .article-tag,
        .article-card:hover .read-more {
          color: #1a1a1a !important;
        }

        .article-img-placeholder {
          height: 180px;
          background-color: #C19A6B; /* Kraft paper color */
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E");
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid #111;
          position: relative;
          overflow: hidden;
        }

        .digital-sticker {
          width: 70px;
          height: 70px;
          background-color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 2px 4px 10px rgba(0,0,0,0.3);
          transform: rotate(-10deg);
          border: 1px solid #eee;
          transition: transform 0.3s ease;
        }

        .article-card:hover .digital-sticker {
          transform: rotate(5deg) scale(1.1);
        }
        
        .digital-sticker span {
          color: #DC143C;
          font-family: var(--font-bebas), sans-serif;
          font-size: 2.2rem;
          line-height: 1;
          margin-top: 5px; /* Adjust for Bebas baseline */
        }

        .article-content {
          padding: 20px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .article-tag {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #DC143C;
          font-weight: bold;
          margin-bottom: 8px;
          display: block;
        }

        .article-content h2 {
          font-size: 18px;
          margin-bottom: 10px;
          line-height: 1.3;
        }

        .article-content p {
          font-size: 13px;
          color: #888;
          line-height: 1.5;
          margin-bottom: 12px;
          flex: 1;
        }

        .intent-snippet {
          font-size: 11px;
          font-weight: 600;
          color: #666;
          margin-bottom: 20px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .read-more {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 4px;
          color: #fff;
          font-family: var(--font-inter), sans-serif;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          padding: 8px 16px;
          opacity: 1;
          transition: all 0.2s;
          width: 100%;
        }
        
        .article-card:hover .read-more {
          background: #fff;
          border-color: #fff;
          color: #DC143C !important;
        }
        
        .read-more:hover {
          opacity: 0.8;
        }
      `}</style>
    </main>
  )
}
