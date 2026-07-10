import { supabase, type Product } from '@/lib/supabase'
import { mockProducts } from '@/lib/mockProducts'
import { notFound } from 'next/navigation'
import ProductDetail from '@/components/ProductDetail'
import { AnimatePresence } from 'framer-motion'

type Props = {
  params: { slug: string }
}

export default async function ModalProductPage({ params }: Props) {
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

  // Render the modal inside AnimatePresence so it animates in correctly
  return (
    <AnimatePresence>
      <ProductDetail product={product} />
    </AnimatePresence>
  )
}
