import { Metadata } from 'next'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getSortedPostsData } from '../../../lib/markdown'

export const metadata: Metadata = {
  title: 'Todos los Artículos | Distrito Pipa Cancún',
  description: 'Compendio completo de artículos, guías y contenido de Distrito Pipa Cancún.',
  alternates: {
    canonical: 'https://distritopipa.com/blog/todos',
  },
}

export default function AllPostsPage() {
  const posts = getSortedPostsData()

  return (
    <main className="all-posts-page">
      <div className="all-posts-container">
        <Link href="/blog" className="back-link">
          ← Volver al Índice del Blog
        </Link>

        <header className="page-header">
          <h1>Todos los Artículos — Distrito Pipa Cancún</h1>
          <p className="subtitle">
            Compendio completo de guías, artículos y recomendaciones sobre accesorios de cristal y entregas locales en Cancún.
          </p>
        </header>

        <div className="posts-list">
          {posts.map((post, idx) => (
            <article key={post.slug} id={post.slug} className="single-post-block">
              <div className="post-meta-header">
                <span className="post-number">Artículo #{idx + 1}</span>
                <Link href={`/blog/${post.slug}`} className="individual-link">
                  Ver artículo individual ↗
                </Link>
              </div>

              <div className="prose-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {post.content}
                </ReactMarkdown>
              </div>

              {idx < posts.length - 1 && <hr className="post-divider" />}
            </article>
          ))}
        </div>
      </div>

      <style>{`
        .all-posts-page {
          min-height: 100vh;
          background-color: #111;
          padding: 40px 20px 80px;
          color: #fff;
        }

        .all-posts-container {
          max-width: 860px;
          margin: 0 auto;
        }

        .back-link {
          display: inline-block;
          margin-bottom: 24px;
          color: #888;
          font-size: 14px;
          text-decoration: none;
          transition: color 0.2s;
        }

        .back-link:hover {
          color: #DC143C;
        }

        .page-header {
          margin-bottom: 48px;
          border-bottom: 1px solid #2a2a2a;
          padding-bottom: 24px;
        }

        .page-header h1 {
          font-family: var(--font-bebas), sans-serif;
          font-size: clamp(36px, 6vw, 56px);
          letter-spacing: 0.03em;
          margin-bottom: 12px;
          color: #fff;
        }

        .subtitle {
          color: #888;
          font-size: 16px;
          line-height: 1.5;
        }

        .single-post-block {
          margin-bottom: 48px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 32px 24px;
        }

        @media (min-width: 768px) {
          .single-post-block {
            padding: 48px 56px;
          }
        }

        .post-meta-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #2a2a2a;
        }

        .post-number {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #DC143C;
          font-weight: 700;
        }

        .individual-link {
          font-size: 12px;
          color: #888;
          text-decoration: none;
        }

        .individual-link:hover {
          color: #fff;
          text-decoration: underline;
        }

        .prose-content {
          font-family: var(--font-inter), sans-serif;
          color: #ccc;
          line-height: 1.7;
        }

        .prose-content h1 {
          font-family: var(--font-bebas), sans-serif;
          font-size: clamp(28px, 5vw, 40px);
          line-height: 1.15;
          margin-bottom: 20px;
          color: #fff;
        }

        .prose-content h2 {
          font-size: 22px;
          font-weight: 700;
          margin-top: 36px;
          margin-bottom: 16px;
          color: #fff;
        }

        .prose-content h3 {
          font-size: 17px;
          font-weight: 600;
          margin-top: 28px;
          margin-bottom: 12px;
          color: #eee;
        }

        .prose-content p {
          font-size: 15px;
          margin-bottom: 18px;
          color: #bbb;
        }

        .prose-content strong {
          color: #fff;
          font-weight: 600;
        }

        .prose-content ul, .prose-content ol {
          margin-bottom: 20px;
          padding-left: 20px;
        }

        .prose-content li {
          margin-bottom: 8px;
        }

        .prose-content a {
          color: #DC143C;
          text-decoration: none;
        }

        .prose-content a:hover {
          text-decoration: underline;
        }

        .post-divider {
          border: 0;
          border-top: 1px solid #333;
          margin: 48px 0 0;
        }
      `}</style>
    </main>
  )
}
