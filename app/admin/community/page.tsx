'use client'
// app/admin/community/page.tsx
// Moderate Q&A posts, manage the blocklist, review flagged content.

import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '@/lib/supabase'

interface Post {
  id: string
  author_name: string
  content: string
  category: string
  status: 'approved' | 'blocked' | 'pending_review'
  block_reason: string | null
  parent_id: string | null
  upvotes: number
  reports: number
  flagged: boolean
  created_at: string
}

interface BlockWord {
  id: number
  word: string
  added_at: string
}

const CATEGORIES = ['general','cuidado','tecnica','novato','offtopic']
const CAT_LABELS: Record<string,string> = {
  general:'General', cuidado:'Cuidado del producto',
  tecnica:'Técnica', novato:'Para principiantes', offtopic:'Off-topic'
}

export default function AdminCommunityPage() {
  const [posts, setPosts]           = useState<Post[]>([])
  const [blocklist, setBlocklist]   = useState<BlockWord[]>([])
  const [tab, setTab]               = useState<'posts'|'blocklist'>('posts')
  const [filter, setFilter]         = useState<'all'|'flagged'|'blocked'|'approved'>('all')
  const [loading, setLoading]       = useState(true)
  const [newWord, setNewWord]       = useState('')
  const [toast, setToast]           = useState<string|null>(null)
  const [expanded, setExpanded]     = useState<string|null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Load ────────────────────────────────────────────────────

  const loadPosts = useCallback(async () => {
    setLoading(true)
    const { data } = await supabaseAdmin
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setPosts(data as Post[])
    setLoading(false)
  }, [])

  const loadBlocklist = useCallback(async () => {
    const { data } = await supabaseAdmin
      .from('community_blocklist')
      .select('*')
      .order('added_at', { ascending: false })
    if (data) setBlocklist(data as BlockWord[])
  }, [])

  useEffect(() => { loadPosts(); loadBlocklist() }, [loadPosts, loadBlocklist])

  // ── Post actions ────────────────────────────────────────────

  async function approvePost(id: string) {
    await supabaseAdmin.from('community_posts')
      .update({ status: 'approved', flagged: false }).eq('id', id)
    setPosts(ps => ps.map(p => p.id===id ? {...p, status:'approved', flagged:false} : p))
    showToast('✅ Post aprobado')
  }

  async function blockPost(id: string) {
    await supabaseAdmin.from('community_posts')
      .update({ status: 'blocked' }).eq('id', id)
    setPosts(ps => ps.map(p => p.id===id ? {...p, status:'blocked'} : p))
    showToast('🚫 Post bloqueado')
  }

  async function deletePost(id: string) {
    if (!confirm('¿Eliminar permanentemente este post?')) return
    await supabaseAdmin.from('community_posts').delete().eq('id', id)
    setPosts(ps => ps.filter(p => p.id !== id))
    showToast('🗑️ Post eliminado')
  }

  // ── Blocklist actions ───────────────────────────────────────

  async function addWord() {
    const word = newWord.trim().toLowerCase()
    if (!word) return
    const { data } = await supabaseAdmin
      .from('community_blocklist')
      .insert({ word })
      .select()
      .single()
    if (data) {
      setBlocklist(bl => [data as BlockWord, ...bl])
      setNewWord('')
      showToast(`🚫 "${word}" agregado a la lista`)
    }
  }

  async function removeWord(id: number, word: string) {
    await supabaseAdmin.from('community_blocklist').delete().eq('id', id)
    setBlocklist(bl => bl.filter(w => w.id !== id))
    showToast(`✓ "${word}" eliminado`)
  }

  // ── Filtered posts ──────────────────────────────────────────

  const filtered = posts.filter(p => {
    if (filter === 'flagged')  return p.flagged || p.status === 'pending_review'
    if (filter === 'blocked')  return p.status === 'blocked'
    if (filter === 'approved') return p.status === 'approved'
    return true
  })

  const counts = {
    all:      posts.length,
    flagged:  posts.filter(p => p.flagged || p.status==='pending_review').length,
    blocked:  posts.filter(p => p.status==='blocked').length,
    approved: posts.filter(p => p.status==='approved').length,
  }

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="comm-page">
      {toast && <div className="toast">{toast}</div>}

      <div className="page-header">
        <div>
          <div className="page-eyebrow">Moderación</div>
          <h1 className="page-title">Comunidad</h1>
        </div>
        <div className="header-tabs">
          <button className={`htab ${tab==='posts'?'active':''}`} onClick={()=>setTab('posts')}>
            Posts ({posts.length})
          </button>
          <button className={`htab ${tab==='blocklist'?'active':''}`} onClick={()=>setTab('blocklist')}>
            Blocklist ({blocklist.length})
          </button>
        </div>
      </div>

      {/* ── POSTS TAB ── */}
      {tab === 'posts' && (
        <>
          <div className="stats-row">
            <div className="stat"><div className="stat-val">{counts.approved}</div><div className="stat-label">Aprobados</div></div>
            <div className="stat"><div className="stat-val" style={{color:'#fbbf24'}}>{counts.flagged}</div><div className="stat-label">Reportados</div></div>
            <div className="stat"><div className="stat-val" style={{color:'#f87171'}}>{counts.blocked}</div><div className="stat-label">Bloqueados</div></div>
          </div>

          <div className="filters">
            {(['all','flagged','blocked','approved'] as const).map(f => (
              <button key={f}
                className={`ftab ${filter===f?'active':''}`}
                onClick={() => setFilter(f)}
              >
                {f==='all'?`Todos (${counts.all})`
                 :f==='flagged'?`⚠️ Reportados (${counts.flagged})`
                 :f==='blocked'?`Bloqueados (${counts.blocked})`
                 :`Aprobados (${counts.approved})`}
              </button>
            ))}
          </div>

          <div className="post-list">
            {loading && <div className="empty">Cargando...</div>}
            {!loading && filtered.length === 0 && <div className="empty">No hay posts en esta vista.</div>}

            {filtered.map(post => (
              <div key={post.id} className={`post-card ${post.flagged?'flagged':''}`}>
                <div className="post-head" onClick={() => setExpanded(expanded===post.id?null:post.id)}>
                  <div className="post-meta">
                    <span className={`status-dot ${post.status}`} />
                    <span className="post-author">{post.author_name}</span>
                    <span className="post-cat">{CAT_LABELS[post.category]||post.category}</span>
                    {post.flagged && <span className="flag-chip">⚠️ {post.reports} reportes</span>}
                    {post.parent_id && <span className="reply-chip">↩ Respuesta</span>}
                  </div>
                  <div className="post-date">
                    {new Date(post.created_at).toLocaleDateString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>

                <div className="post-content">{post.content}</div>

                {post.block_reason && (
                  <div className="block-reason">🤖 Auto-bloqueado: {post.block_reason}</div>
                )}

                <div className="post-actions">
                  <span className="upvotes">▲ {post.upvotes}</span>
                  {post.status !== 'approved' && (
                    <button className="act-approve" onClick={() => approvePost(post.id)}>✅ Aprobar</button>
                  )}
                  {post.status !== 'blocked' && (
                    <button className="act-block" onClick={() => blockPost(post.id)}>🚫 Bloquear</button>
                  )}
                  <button className="act-delete" onClick={() => deletePost(post.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── BLOCKLIST TAB ── */}
      {tab === 'blocklist' && (
        <div className="blocklist-section">
          <div className="bl-info">
            <p>Palabras en esta lista se detectan automáticamente al enviar un post. El post queda bloqueado sin que el usuario lo sepa. Soporta detección parcial (evasiones con puntos o guiones).</p>
          </div>

          <div className="add-word-row">
            <input
              className="word-input"
              value={newWord}
              onChange={e => setNewWord(e.target.value)}
              onKeyDown={e => e.key==='Enter' && addWord()}
              placeholder="Nueva palabra o frase..."
            />
            <button className="btn-add" onClick={addWord}>+ Agregar</button>
          </div>

          <div className="word-grid">
            {blocklist.map(w => (
              <div key={w.id} className="word-chip">
                <span className="word-text">{w.word}</span>
                <button className="word-remove" onClick={() => removeWord(w.id, w.word)} title="Eliminar">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .comm-page{min-height:100vh;background:#111;color:#fff;font-family:-apple-system,sans-serif;padding-bottom:60px}
        .toast{position:fixed;top:16px;right:16px;z-index:999;background:#1a1a1a;border:1px solid #2a2a2a;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,.5);animation:slideIn .2s ease}
        @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}
        .page-header{display:flex;align-items:center;justify-content:space-between;padding:28px 20px 20px;border-bottom:1px solid #2a2a2a;flex-wrap:wrap;gap:12px}
        .page-eyebrow{font-size:10px;color:#888;letter-spacing:.12em;text-transform:uppercase;margin-bottom:3px}
        .page-title{font-size:22px;font-weight:600}
        .header-tabs{display:flex;gap:8px}
        .htab{padding:8px 16px;border-radius:8px;border:0.5px solid #2a2a2a;background:transparent;color:#888;font-size:13px;cursor:pointer;transition:all .15s}
        .htab:hover{color:#fff}
        .htab.active{background:#CC2222;color:#fff;border-color:#CC2222}
        .stats-row{display:flex;gap:8px;padding:16px 20px;flex-wrap:wrap}
        .stat{background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:8px;padding:10px 14px;text-align:center;min-width:64px}
        .stat-val{font-size:20px;font-weight:600}
        .stat-label{font-size:9px;color:#888;text-transform:uppercase;margin-top:2px}
        .filters{display:flex;gap:8px;padding:0 20px 14px;flex-wrap:wrap}
        .ftab{padding:5px 14px;border-radius:20px;border:0.5px solid #2a2a2a;background:transparent;color:#888;font-size:11px;cursor:pointer;transition:all .15s}
        .ftab:hover{color:#fff}
        .ftab.active{background:#CC2222;color:#fff;border-color:#CC2222}
        .post-list{display:flex;flex-direction:column;gap:8px;padding:0 20px}
        .empty{padding:40px;text-align:center;color:#888;font-size:14px}
        .post-card{background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:10px;padding:14px;transition:border-color .15s}
        .post-card.flagged{border-color:rgba(251,146,60,.4)}
        .post-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;cursor:pointer;flex-wrap:wrap;gap:6px}
        .post-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
        .status-dot.approved{background:#4ade80}
        .status-dot.blocked{background:#f87171}
        .status-dot.pending_review{background:#fbbf24}
        .post-author{font-size:13px;font-weight:500}
        .post-cat{font-size:11px;color:#888;background:#2a2a2a;padding:2px 8px;border-radius:10px}
        .flag-chip{font-size:10px;background:rgba(251,146,60,.15);color:#fb923c;border:1px solid rgba(251,146,60,.3);padding:2px 8px;border-radius:10px}
        .reply-chip{font-size:10px;color:#888;background:#2a2a2a;padding:2px 8px;border-radius:10px}
        .post-date{font-size:11px;color:#555;flex-shrink:0}
        .post-content{font-size:13px;color:#ccc;line-height:1.6;margin-bottom:10px;background:#111;padding:10px 12px;border-radius:7px}
        .block-reason{font-size:11px;color:#f87171;background:rgba(248,113,113,.1);border:0.5px solid rgba(248,113,113,.2);padding:6px 10px;border-radius:6px;margin-bottom:10px}
        .post-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .upvotes{font-size:11px;color:#888;margin-right:4px}
        .act-approve{padding:5px 12px;border-radius:6px;font-size:11px;font-weight:500;cursor:pointer;background:rgba(74,222,128,.1);color:#4ade80;border:1px solid rgba(74,222,128,.3)}
        .act-block{padding:5px 12px;border-radius:6px;font-size:11px;font-weight:500;cursor:pointer;background:rgba(248,113,113,.1);color:#f87171;border:1px solid rgba(248,113,113,.3)}
        .act-delete{padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;background:transparent;color:#555;border:0.5px solid #2a2a2a}
        .act-delete:hover{color:#f87171}
        .blocklist-section{padding:20px}
        .bl-info{background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:8px;padding:14px;margin-bottom:16px;font-size:13px;color:#888;line-height:1.6}
        .add-word-row{display:flex;gap:8px;margin-bottom:16px}
        .word-input{flex:1;background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:8px;color:#fff;padding:10px 14px;font-size:13px}
        .word-input:focus{outline:none;border-color:#CC2222}
        .btn-add{padding:10px 18px;background:#CC2222;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
        .btn-add:hover{background:#e02222}
        .word-grid{display:flex;flex-wrap:wrap;gap:8px}
        .word-chip{display:flex;align-items:center;gap:6px;background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:20px;padding:6px 12px}
        .word-text{font-size:13px;color:#ccc}
        .word-remove{background:none;border:none;color:#555;cursor:pointer;font-size:14px;padding:0;line-height:1}
        .word-remove:hover{color:#f87171}
      `}</style>
    </div>
  )
}
