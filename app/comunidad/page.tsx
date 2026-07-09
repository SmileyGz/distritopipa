import { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import ComunidadClient, { Post, Answer } from './ComunidadClient'

export const metadata: Metadata = {
  title: 'Comunidad · Distrito Pipa',
  description: 'Únete a la comunidad de Distrito Pipa. Resuelve tus dudas sobre bongs, pipas, envíos en Cancún y gana recompensas por participar.',
}

export const revalidate = 60

const defaultPosts: Post[] = [
  {
    id: 'q1',
    author: { phone: '1234567890', nickname: 'Pedro_Cancun' },
    content: '¿Cuánto tarda el envío?',
    upvotes: 8,
    answers: [
      { id: 'a1', author: { phone: '9999999999', nickname: 'DistritoPipa' }, content: 'El envío suele tardar entre 1 a 6 km toma alrededor de 45 mins - 1 hora en llegar a tu puerta.', upvotes: 12 },
    ]
  },
  {
    id: 'q2',
    author: { phone: '8888888888', nickname: 'SmokeKing' },
    content: '¿El empaque es discreto?',
    upvotes: 5,
    answers: []
  },
  {
    id: 'q3',
    author: { phone: '5555555555', nickname: 'MariaG' },
    content: '¿Cómo pago el anticipo?',
    upvotes: 2,
    answers: []
  }
]

export default async function ComunidadPage() {
  let initialPosts: Post[] = defaultPosts

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
