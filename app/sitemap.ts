import { MetadataRoute } from 'next'
import { supabase } from '@/lib/supabase'
import { getSortedPostsData } from '@/lib/markdown'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://distritopipa.com'

  const { data: products } = await supabase.from('products').select('slug, updated_at')
  
  const productUrls = (products || []).map(product => ({
    url: `${baseUrl}/producto/${product.slug}`,
    lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  const blogPosts = getSortedPostsData()
  const blogUrls = blogPosts.map(post => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  const staticUrls = [
    '',
    '/catalogo',
    '/mayoreo',
    '/blog',
    '/comunidad'
  ].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.9,
  }))

  return [...staticUrls, ...productUrls, ...blogUrls]
}
