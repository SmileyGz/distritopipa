import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getPostData, getSortedPostsData } from '../../../lib/markdown'

type Props = {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const postData = getPostData(params.slug)
  
  if (!postData) {
    return { title: 'Post no encontrado' }
  }
  
  return {
    title: `${postData.title} | Cultura Distrito Pipa Cancún`,
    description: postData.meta_description,
    keywords: [postData.focus_keyword, 'Cancun', 'Distrito Pipa'],
    alternates: {
      canonical: `https://distritopipa.com/blog/${params.slug}`,
    },
  }
}

export async function generateStaticParams() {
  const posts = getSortedPostsData()
  return posts.map((post) => ({
    slug: post.slug,
  }))
}

export default function PostPage({ params }: Props) {
  const postData = getPostData(params.slug)
  
  if (!postData) {
    notFound()
  }

  return (
    <main className="post-page">
      <div className="post-container">
        
        {/* Schema Markup for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              "headline": postData.title,
              "description": postData.meta_description,
              "author": {
                "@type": "Organization",
                "name": "Distrito Pipa Cancún",
                "url": "https://distritopipa.com"
              },
              "publisher": {
                "@type": "Organization",
                "name": "Distrito Pipa Cancún",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://distritopipa.com/logo.png"
                }
              },
              "datePublished": "2026-07-08T00:00:00Z" // Hardcoded for demo, normally would come from markdown frontmatter
            })
          }}
        />

        <Link href="/blog" className="back-link">
          ← Volver al Blog
        </Link>
        
        <article className="prose-container">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {postData.content}
          </ReactMarkdown>
        </article>

      </div>

      <style>{`
        .post-page {
          min-height: 100vh;
          background-color: #111;
          padding: 40px 20px 80px 20px;
          color: #fff;
        }

        .post-container {
          max-width: 800px;
          margin: 0 auto;
        }
        
        .back-link {
          display: inline-block;
          margin-bottom: 30px;
          color: #888;
          font-size: 14px;
          text-decoration: none;
          transition: color 0.2s;
        }
        
        .back-link:hover {
          color: #DC143C;
        }
        
        .prose-container {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 30px 20px;
          font-family: var(--font-inter), sans-serif;
        }
        
        @media (min-width: 768px) {
          .prose-container {
            padding: 50px 60px;
          }
        }
        
        /* Markdown Styles matching brand */
        .prose-container h1 {
          font-family: var(--font-bebas), sans-serif;
          font-size: clamp(32px, 6vw, 48px);
          line-height: 1.1;
          margin-bottom: 24px;
          letter-spacing: 0.02em;
          color: #fff;
        }
        
        .prose-container h2 {
          font-size: 24px;
          font-weight: 700;
          margin-top: 40px;
          margin-bottom: 16px;
          color: #fff;
        }
        
        .prose-container h3 {
          font-size: 18px;
          font-weight: 600;
          margin-top: 32px;
          margin-bottom: 12px;
          color: #ddd;
        }
        
        .prose-container p {
          font-size: 16px;
          line-height: 1.6;
          color: #bbb;
          margin-bottom: 20px;
        }
        
        .prose-container strong {
          color: #fff;
          font-weight: 600;
        }
        
        .prose-container ul, .prose-container ol {
          margin-bottom: 24px;
          padding-left: 20px;
          color: #bbb;
        }
        
        .prose-container li {
          margin-bottom: 8px;
          line-height: 1.5;
        }
        
        .prose-container a {
          color: #DC143C;
          text-decoration: none;
          font-weight: 600;
        }
        
        .prose-container a:hover {
          text-decoration: underline;
        }
      `}</style>
    </main>
  )
}
