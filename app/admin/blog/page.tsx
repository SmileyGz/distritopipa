'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { savePostAction } from './actions'
import dynamic from 'next/dynamic'
import 'easymde/dist/easymde.min.css'

const SimpleMdeReact = dynamic(() => import('react-simplemde-editor'), { ssr: false })

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
  image_url?: string
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
    const postToSave = { ...editingPost }
    if (!postToSave.id) delete postToSave.id

    const res = await savePostAction(postToSave)
    
    if (!res.success) {
      alert('Error guardando: ' + res.error)
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
            <label>Imagen de Portada (Opcional):</label><br/>
            {editingPost.image_url && (
              <img src={editingPost.image_url} alt="Portada" style={{ width: '100%', maxWidth: '300px', marginBottom: '10px', borderRadius: '8px' }} />
            )}
            <input 
              type="file" 
              accept="image/png, image/jpeg, image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                
                setLoading(true)
                const formData = new FormData()
                formData.append('file', file)
                formData.append('category', 'blog')
                
                try {
                  const res = await fetch('/api/upload', { method: 'POST', body: formData })
                  const data = await res.json()
                  if (data.url) {
                    setEditingPost({ ...editingPost, image_url: data.url })
                  } else {
                    alert(data.error || 'Error al subir la imagen')
                  }
                } catch (err) {
                  alert('Error al subir la imagen')
                }
                setLoading(false)
              }} 
              style={{ display: 'block', width: '100%', padding: '8px', color: '#000', backgroundColor: '#fff' }} 
            />
          </div>
          <div>
            <label>Título:</label><br/>
            <input required type="text" value={editingPost.title} onChange={e => setEditingPost({...editingPost, title: e.target.value})} style={{ width: '100%', padding: '8px', color: '#000', backgroundColor: '#fff' }} />
          </div>
          <div>
            <label>Slug (URL):</label><br/>
            <input required type="text" value={editingPost.slug} onChange={e => setEditingPost({...editingPost, slug: e.target.value})} style={{ width: '100%', padding: '8px', color: '#000', backgroundColor: '#fff' }} />
          </div>
          <div>
            <label>Meta Descripción (invisible al público, solo para Google/SEO):</label><br/>
            <textarea required value={editingPost.meta_description} onChange={e => setEditingPost({...editingPost, meta_description: e.target.value})} style={{ width: '100%', padding: '8px', color: '#000', backgroundColor: '#fff' }} rows={3} />
          </div>
          <div>
            <label>Palabra Clave (Focus Keyword):</label><br/>
            <input type="text" value={editingPost.focus_keyword} onChange={e => setEditingPost({...editingPost, focus_keyword: e.target.value})} style={{ width: '100%', padding: '8px', color: '#000', backgroundColor: '#fff' }} />
          </div>
          <div>
            <label>Contenido del Artículo (Usa la barra de herramientas. Para inyectar productos usa el icono de código <code>```product</code>):</label><br/>
            <div style={{ backgroundColor: '#fff', color: '#000', borderRadius: '4px' }} className="mde-wrapper">
              <style>{`
                .mde-wrapper .editor-toolbar button, .mde-wrapper .editor-toolbar button i { color: #222 !important; }
                .mde-wrapper .editor-toolbar button.active, .mde-wrapper .editor-toolbar button:hover { background: #e0e0e0; color: #000 !important; }
                .mde-wrapper .editor-toolbar button.active i, .mde-wrapper .editor-toolbar button:hover i { color: #000 !important; }
                .mde-wrapper .editor-toolbar i.separator { border-color: #ccc !important; border-right: none !important; }
              `}</style>
              <SimpleMdeReact 
                value={editingPost.content} 
                onChange={useCallback((val: string) => {
                  setEditingPost(prev => prev ? { ...prev, content: val } : null)
                }, [])}
                options={{
                  spellChecker: false,
                  maxHeight: '400px',
                  placeholder: 'Escribe tu artículo aquí...'
                }}
              />
            </div>
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
