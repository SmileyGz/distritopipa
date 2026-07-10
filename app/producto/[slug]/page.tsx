import { supabase, type Product } from '@/lib/supabase'
import { mockProducts } from '@/lib/mockProducts'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProductPageClient from './ProductPageClient'

type Props = {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  let product: Product | undefined

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co') {
    product = mockProducts.find(p => p.slug === params.slug)
  } else {
    const { data } = await supabase.from('products').select('*').eq('slug', params.slug).single()
    if (data) product = data as Product
  }

  if (!product) return { title: 'Producto no encontrado | Distrito Pipa' }

  const metaDesc = product.meta_description_es 
    ? product.meta_description_es
    : (product.description_es || '').slice(0, 150) + '... Entregas el mismo día en Cancún, empaque discreto.'

  return {
    title: `${product.name_es} con Entrega Rápida en Cancún | Distrito Pipa`,
    description: metaDesc,
    openGraph: {
      title: `${product.name_es} | Distrito Pipa Cancún`,
      description: metaDesc,
      images: product.image_paths?.[0] ? [{ url: product.image_paths[0] }] : [],
    }
  }
}

export default async function ProductPage({ params }: Props) {
  let product: Product | undefined

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co') {
    product = mockProducts.find(p => p.slug === params.slug)
  } else {
    const { data } = await supabase.from('products').select('*').eq('slug', params.slug).single()
    if (data) product = data as Product
  }

  if (!product) {
    notFound()
  }

  // Pass to client component for interactivity (quantity, add to cart, colors, sizes)
  return <ProductPageClient product={product} />
}
