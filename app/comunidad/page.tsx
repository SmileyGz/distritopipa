import { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import ComunidadClient, { Post, Answer } from './ComunidadClient'

export const metadata: Metadata = {
  title: 'Comunidad · Distrito Pipa',
  description: 'Únete a la comunidad de Distrito Pipa. Resuelve tus dudas sobre bongs, pipas, envíos en Cancún y gana recompensas por participar.',
  alternates: {
    canonical: 'https://distritopipa.com/comunidad',
  },
}

export const revalidate = 60

export default async function ComunidadPage() {
  let initialPosts: Post[] = []

  try {
    const { data: rawPosts, error } = await supabase
      .from('community_posts')
      .select('id, author_name, content, upvotes, parent_id, customer_id, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })

    if (!error && rawPosts && rawPosts.length > 0) {
      // Separate top-level questions and answers
      const questions = rawPosts.filter(p => !p.parent_id)
      const answers = rawPosts.filter(p => p.parent_id)

      initialPosts = questions.map(q => {
        const postAnswers = answers
          .filter(a => a.parent_id === q.id)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map(a => ({
            id: a.id,
            author: { phone: a.customer_id || '', nickname: a.author_name },
            content: a.content,
            upvotes: a.upvotes || 0
          } as Answer))

        return {
          id: q.id,
          author: { phone: q.customer_id || '', nickname: q.author_name },
          content: q.content,
          upvotes: q.upvotes || 0,
          answers: postAnswers
        } as Post
      })
    }
  } catch (err) {
    console.error('Error fetching community posts', err)
  }

  return (
    <ComunidadClient initialPosts={initialPosts} />
  )
}
