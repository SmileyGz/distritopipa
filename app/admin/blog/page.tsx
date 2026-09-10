'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Utilizar cliente del lado del cliente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

type BlogPost = {
  id?: string
  slug: string
  title: string
  meta_description: string
  focus_keyword: string
  content: string
}

export default function AdminBlog() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPosts()
  }, [])

  async function fetchPosts() {
    setLoading(true)
    const { data, error } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false })
    if (!error && data) {
      setPosts(data)
    }
    setLoading(false)
  }

  async function savePost(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPost) return

    setLoading(true)
    // If it's a new post without ID, we don't send the ID to let Supabase generate it
    const postToSave = { ...editingPost }
    if (!postToSave.id) delete postToSave.id

    const { error } = await supabase.from('blog_posts').upsert(postToSave, { onConflict: 'slug' })
    
    if (error) {
      alert('Error guardando: ' + error.message)
    } else {
      alert('Guardado con éxito!')
      setEditingPost(null)
      fetchPosts()
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '20px', color: '#fff', fontFamily: 'sans-serif' }}>
      <h1>Gestor del Blog (CMS Supabase)</h1>
      
      {!editingPost ? (
        <div>
          <button 
            onClick={() => setEditingPost({ slug: '', title: '', meta_description: '', focus_keyword: '', content: '' })}
            style={{ padding: '10px 20px', background: '#DC143C', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px' }}
          >
            + Crear Nuevo Post
          </button>

          {loading ? <p>Cargando posts...</p> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {posts.map(post => (
                <li key={post.slug} style={{ background: '#222', margin: '10px 0', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{post.title} (/{post.slug})</span>
                  <button 
                    onClick={() => setEditingPost(post)}
                    style={{ padding: '8px 16px', background: '#444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Editar
                  </button>
                </li>
              ))}
              {posts.length === 0 && <p>No hay posts en la base de datos todavía. Recuerda migrar los archivos locales primero.</p>}
            </ul>
          )}
        </div>
      ) : (
        <form onSubmit={savePost} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '800px' }}>
          <div>
            <label>Título:</label><br/>
            <input required type="text" value={editingPost.title} onChange={e => setEditingPost({...editingPost, title: e.target.value})} style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label>Slug (URL):</label><br/>
            <input required type="text" value={editingPost.slug} onChange={e => setEditingPost({...editingPost, slug: e.target.value})} style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label>Meta Descripción (invisible al público, solo para Google/SEO):</label><br/>
            <textarea required value={editingPost.meta_description} onChange={e => setEditingPost({...editingPost, meta_description: e.target.value})} style={{ width: '100%', padding: '8px' }} rows={3} />
          </div>
          <div>
            <label>Palabra Clave (Focus Keyword):</label><br/>
            <input type="text" value={editingPost.focus_keyword} onChange={e => setEditingPost({...editingPost, focus_keyword: e.target.value})} style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label>Contenido Markdown (usa los bloques de ```product aquí!):</label><br/>
            <textarea required value={editingPost.content} onChange={e => setEditingPost({...editingPost, content: e.target.value})} style={{ width: '100%', padding: '8px', fontFamily: 'monospace' }} rows={20} />
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button disabled={loading} type="submit" style={{ padding: '10px 20px', background: '#DC143C', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {loading ? 'Guardando...' : 'Guardar y Publicar en Vivo'}
            </button>
            <button type="button" onClick={() => setEditingPost(null)} style={{ padding: '10px 20px', background: '#555', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
