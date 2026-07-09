'use client'
import { useState, useEffect } from 'react'

import { supabase } from '@/lib/supabase'

type UserProfile = { phone: string, nickname: string }
type Answer = { id: string, author: UserProfile, content: string, upvotes: number }
type Post = { id: string, author: UserProfile, content: string, upvotes: number, answers: Answer[] }

export default function AdminCommunityPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string|null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchPosts = async () => {
    setLoading(true)
    const { data: rawPosts, error } = await supabase
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (rawPosts) {
      const questions = rawPosts.filter(p => !p.parent_id)
      const answers = rawPosts.filter(p => p.parent_id)

      const formattedPosts = questions.map(q => {
        const postAnswers = answers
          .filter(a => a.parent_id === q.id)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map(a => ({
            id: a.id,
            author: { phone: a.customer_id || '', nickname: a.author_name },
            content: a.content,
            upvotes: a.upvotes || 0
          }))

        return {
          id: q.id,
          author: { phone: q.customer_id || '', nickname: q.author_name },
          content: q.content,
          upvotes: q.upvotes || 0,
          answers: postAnswers
        }
      })
      setPosts(formattedPosts)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchPosts()
  }, [])

  async function deletePost(id: string) {
    if (!confirm('¿Eliminar permanentemente este post de la comunidad?')) return
    await supabase.from('community_posts').delete().eq('id', id)
    showToast('🗑️ Post eliminado')
    fetchPosts()
  }

  async function deleteAnswer(postId: string, answerId: string) {
    if (!confirm('¿Eliminar permanentemente esta respuesta?')) return
    await supabase.from('community_posts').delete().eq('id', answerId)
    showToast('🗑️ Respuesta eliminada')
    fetchPosts()
  }

  if (loading) return <div className="p-8 text-white">Cargando comunidad...</div>

  return (
    <div className="admin-community-page">
      {toast && <div className="toast-notification">{toast}</div>}
      
      <header className="page-header">
        <h1>Moderación de la Comunidad</h1>
        <p>Administra las preguntas y respuestas públicas.</p>
      </header>

      <div className="posts-list">
        {posts.length === 0 ? (
          <p className="text-gray-400">No hay posts en la comunidad.</p>
        ) : (
          posts.map(post => (
            <div key={post.id} className="admin-post-card">
              <div className="post-header">
                <span className="post-author">@{post.author.nickname} ({post.author.phone})</span>
                <button onClick={() => deletePost(post.id)} className="btn-delete">Eliminar Post</button>
              </div>
              <h3 className="post-content">{post.content}</h3>
              
              <div className="admin-answers">
                <h4>Respuestas ({post.answers.length})</h4>
                {post.answers.map(ans => (
                  <div key={ans.id} className="admin-answer-item">
                    <span className="ans-author">@{ans.author.nickname}</span>
                    <p>{ans.content}</p>
                    <button onClick={() => deleteAnswer(post.id, ans.id)} className="btn-delete-small">Borrar</button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .admin-community-page { padding: 40px; color: #fff; max-width: 900px; margin: 0 auto; }
        .page-header { margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 20px; }
        .page-header h1 { font-size: 28px; font-weight: bold; margin-bottom: 8px; color: #DC143C; }
        .page-header p { color: #888; font-size: 14px; }
        
        .toast-notification { position: fixed; bottom: 20px; right: 20px; background: #fff; color: #000; padding: 12px 24px; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 50; }
        
        .posts-list { display: flex; flex-direction: column; gap: 20px; }
        .admin-post-card { background: #111; border: 1px solid #333; border-radius: 8px; padding: 20px; }
        .post-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .post-author { color: #aaa; font-weight: 500; font-size: 13px; }
        .post-content { font-size: 18px; margin-bottom: 20px; font-weight: 600; line-height: 1.4; }
        
        .admin-answers { background: #000; padding: 16px; border-radius: 6px; border: 1px dashed #333; }
        .admin-answers h4 { font-size: 12px; text-transform: uppercase; color: #666; margin-bottom: 12px; letter-spacing: 1px; }
        .admin-answer-item { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #222; }
        .admin-answer-item:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
        .ans-author { font-weight: bold; color: #888; font-size: 13px; min-width: 100px; }
        .admin-answer-item p { flex: 1; font-size: 14px; color: #ccc; margin: 0; }
        
        .btn-delete { background: transparent; color: #DC143C; border: 1px solid #DC143C; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .btn-delete:hover { background: #DC143C; color: #fff; }
        
        .btn-delete-small { background: transparent; color: #888; border: none; font-size: 12px; text-decoration: underline; cursor: pointer; }
        .btn-delete-small:hover { color: #DC143C; }
      `}</style>
    </div>
  )
}
