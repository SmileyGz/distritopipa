'use client'
// app/admin/campaigns/page.tsx
// ─────────────────────────────────────────────────────────────
// 2-month social media campaign builder.
// - List / create campaigns
// - 8-week calendar grid (week rows × post-type columns)
// - Tap any cell → post editor drawer
// - AI caption generation via Claude API
// - Product picker from Supabase catalog
// - Status: draft → ready → posted
// - Export: copy caption, screenshot-ready view
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin, type Product } from '@/lib/supabase'

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || ''

const POST_TYPES = [
  { value: 'product',   label: 'Producto',   icon: '📦', color: '#CC2222' },
  { value: 'promo',     label: 'Promo',       icon: '🏷️', color: '#f97316' },
  { value: 'lifestyle', label: 'Lifestyle',   icon: '🌴', color: '#22c55e' },
  { value: 'story',     label: 'Story',       icon: '⚡', color: '#a78bfa' },
  { value: 'reel',      label: 'Reel',        icon: '🎬', color: '#60a5fa' },
  { value: 'community', label: 'Comunidad',   icon: '💬', color: '#fbbf24' },
]

const PLATFORMS = [
  { value: 'instagram_feed',  label: 'IG Feed',    icon: '📸' },
  { value: 'instagram_story', label: 'IG Story',   icon: '⭕' },
  { value: 'instagram_reel',  label: 'IG Reel',    icon: '🎬' },
  { value: 'facebook',        label: 'Facebook',   icon: '👍' },
  { value: 'facebook_story',  label: 'FB Story',   icon: '⭕' },
]

const STATUS_CONFIG = {
  draft:  { label: 'Borrador', color: '#888',    bg: 'rgba(136,136,136,.1)'   },
  ready:  { label: 'Listo',    color: '#60a5fa', bg: 'rgba(96,165,250,.1)'    },
  posted: { label: 'Publicado',color: '#4ade80', bg: 'rgba(74,222,128,.1)'    },
}

const DISCLAIMER = 'Accesorios de uso personal · Producto legal · No incluye sustancias'
const CHAR_LIMITS: Record<string, number> = {
  instagram_feed: 2200, instagram_story: 60, instagram_reel: 150,
  facebook: 300, facebook_story: 50,
}

type Campaign = {
  id: string; name: string; theme?: string; description?: string
  start_date: string; end_date: string; status: string
  total_posts: number; posted: number; ready: number; drafts: number; completion_pct: number
}

type CampaignPost = {
  id: string; campaign_id: string; scheduled_date: string
  week_number: number; day_of_week: string; post_type: string; platform: string
  caption?: string; hashtags?: string; cta?: string; image_note?: string
  product_id?: string; product_name?: string; product_price?: number
  include_disclaimer: boolean; status: string; posted_at?: string
  posted_url?: string; ai_generated: boolean
}

type Week = { weekNum: number; dates: string[]; label: string }

// ─── Helper: generate 8 weeks from start date ────────────────
function generateWeeks(startDate: string): Week[] {
  const weeks: Week[] = []
  const start = new Date(startDate + 'T12:00:00')
  for (let w = 0; w < 8; w++) {
    const dates: string[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      dates.push(date.toISOString().slice(0, 10))
    }
    const weekStart = new Date(dates[0] + 'T12:00:00')
    weeks.push({
      weekNum: w + 1,
      dates,
      label: `Semana ${w + 1} · ${weekStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`,
    })
  }
  return weeks
}

// ─── Full export text for a post ─────────────────────────────
function buildExportText(post: CampaignPost): string {
  const parts = []
  if (post.caption) parts.push(post.caption)
  if (post.cta) parts.push(post.cta)
  if (post.hashtags) parts.push(post.hashtags)
  if (post.include_disclaimer) parts.push('—\n' + DISCLAIMER + '\n+18 · Solo adultos')
  return parts.join('\n\n')
}

// ─────────────────────────────────────────────────────────────
export default function AdminCampaignsPage() {
  const [view, setView]               = useState<'list' | 'calendar'>('list')
  const [campaigns, setCampaigns]     = useState<Campaign[]>([])
  const [activeCampaign, setActive]   = useState<Campaign | null>(null)
  const [posts, setPosts]             = useState<CampaignPost[]>([])
  const [weeks, setWeeks]             = useState<Week[]>([])
  const [products, setProducts]       = useState<Product[]>([])
  const [loading, setLoading]         = useState(true)
  const [toast, setToast]             = useState<string | null>(null)

  // Post editor drawer
  const [editPost, setEditPost]       = useState<Partial<CampaignPost> | null>(null)
  const [editDate, setEditDate]       = useState<string | null>(null)
  const [generating, setGenerating]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [copied, setCopied]           = useState(false)

  // New campaign form
  const [newCampaign, setNewCampaign] = useState({
    name: '', theme: '', description: '', start_date: '', end_date: '',
  })
  const [showNewForm, setShowNewForm] = useState(false)

  // ── Helpers ─────────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function adminHeaders() {
    return { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET }
  }

  // ── Load campaigns ───────────────────────────────────────────
  const loadCampaigns = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/campaigns', { headers: adminHeaders() })
    const json = await res.json()
    if (json.campaigns) setCampaigns(json.campaigns)
    setLoading(false)
  }, [])

  // ── Load products for picker ─────────────────────────────────
  const loadProducts = useCallback(async () => {
    const { data } = await supabaseAdmin.from('products').select('id, name_es, price_mxn, category').eq('in_stock', true).order('category').order('sort_order')
    if (data) setProducts(data as Product[])
  }, [])

  useEffect(() => { loadCampaigns(); loadProducts() }, [loadCampaigns, loadProducts])

  // ── Open campaign calendar ───────────────────────────────────
  async function openCampaign(c: Campaign) {
    setActive(c)
    setWeeks(generateWeeks(c.start_date))
    const res = await fetch(`/api/campaigns/${c.id}/posts`, { headers: adminHeaders() })
    const json = await res.json()
    setPosts(json.posts || [])
    setView('calendar')
  }

  // ── Create campaign ──────────────────────────────────────────
  async function createCampaign() {
    if (!newCampaign.name || !newCampaign.start_date || !newCampaign.end_date) {
      showToast('⚠️ Nombre y fechas son requeridos')
      return
    }
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(newCampaign),
    })
    const json = await res.json()
    if (json.campaign) {
      showToast('✅ Campaña creada')
      setShowNewForm(false)
      setNewCampaign({ name: '', theme: '', description: '', start_date: '', end_date: '' })
      loadCampaigns()
    }
  }

  // ── Open post editor ─────────────────────────────────────────
  function openPostEditor(date: string) {
    const existing = posts.find(p => p.scheduled_date === date)
    setEditDate(date)
    setEditPost(existing || {
      scheduled_date: date,
      post_type: 'product',
      platform: 'instagram_feed',
      caption: '',
      hashtags: '#DistritoPipa #Cancún #AccesoriosPersonales',
      cta: '📲 Pide el tuyo → distritopipa.com',
      image_note: '',
      include_disclaimer: true,
      status: 'draft',
    })
  }

  // ── Save post ────────────────────────────────────────────────
  async function savePost() {
    if (!activeCampaign || !editPost) return
    setSaving(true)

    const isNew = !editPost.id
    const method = isNew ? 'POST' : 'PATCH'
    const body = isNew
      ? editPost
      : { post_id: editPost.id, ...editPost }

    const res = await fetch(`/api/campaigns/${activeCampaign.id}/posts`, {
      method,
      headers: adminHeaders(),
      body: JSON.stringify(body),
    })
    const json = await res.json()

    if (json.post) {
      if (isNew) setPosts(ps => [...ps, json.post])
      else setPosts(ps => ps.map(p => p.id === json.post.id ? json.post : p))
      showToast('✅ Post guardado')
      setEditPost(null)
    }
    setSaving(false)
  }

  // ── Delete post ──────────────────────────────────────────────
  async function deletePost(postId: string) {
    if (!activeCampaign) return
    await fetch(`/api/campaigns/${activeCampaign.id}/posts?post_id=${postId}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    })
    setPosts(ps => ps.filter(p => p.id !== postId))
    setEditPost(null)
    showToast('🗑️ Post eliminado')
  }

  // ── Advance status ───────────────────────────────────────────
  async function advanceStatus(post: CampaignPost) {
    const next = post.status === 'draft' ? 'ready' : post.status === 'ready' ? 'posted' : null
    if (!next || !activeCampaign) return

    const res = await fetch(`/api/campaigns/${activeCampaign.id}/posts`, {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ post_id: post.id, status: next }),
    })
    const json = await res.json()
    if (json.post) {
      setPosts(ps => ps.map(p => p.id === json.post.id ? json.post : p))
      showToast(`${next === 'ready' ? '✅ Marcado listo' : '🎉 Marcado como publicado'}`)
    }
  }

  // ── Generate AI caption ──────────────────────────────────────
  async function generateCaption() {
    if (!editPost) return
    setGenerating(true)
    const product = products.find(p => p.id === editPost.product_id)
    const res = await fetch('/api/generate-caption', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        post_type:      editPost.post_type,
        platform:       editPost.platform,
        product_name:   product?.name_es || editPost.product_name,
        product_price:  product?.price_mxn || editPost.product_price,
        campaign_theme: activeCampaign?.theme,
        extra_context:  editPost.image_note,
      }),
    })
    const json = await res.json()
    if (json.caption) {
      setEditPost(p => ({ ...p, caption: json.caption, ai_generated: true }))
      showToast('✨ Caption generado con IA')
    }
    setGenerating(false)
  }

  // ── Copy export text ─────────────────────────────────────────
  function copyCaption() {
    if (!editPost) return
    const text = buildExportText(editPost as CampaignPost)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      showToast('📋 Caption copiado')
    })
  }

  // ── Get post for a date ──────────────────────────────────────
  function getPost(date: string) {
    return posts.find(p => p.scheduled_date === date)
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="camps-page">
      {toast && <div className="toast">{toast}</div>}

      {/* ── POST EDITOR DRAWER ── */}
      {editPost && (
        <>
          <div className="drawer-overlay" onClick={() => setEditPost(null)} />
          <div className="post-drawer">
            <div className="drawer-handle-row">
              <div className="drawer-handle" />
              <button className="drawer-close" onClick={() => setEditPost(null)}>✕</button>
            </div>

            <div className="drawer-scroll">
              <div className="drawer-inner">

                {/* Date + type header */}
                <div className="drawer-date-row">
                  <span className="drawer-date">{editDate && new Date(editDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' })}</span>
                  {editPost.id && (
                    <span className="drawer-status-pill" style={{
                      background: STATUS_CONFIG[editPost.status as keyof typeof STATUS_CONFIG]?.bg,
                      color: STATUS_CONFIG[editPost.status as keyof typeof STATUS_CONFIG]?.color,
                    }}>
                      {STATUS_CONFIG[editPost.status as keyof typeof STATUS_CONFIG]?.label}
                    </span>
                  )}
                </div>

                {/* Post type + platform */}
                <div className="field-row-2">
                  <div>
                    <label className="field-label">Tipo de post</label>
                    <select className="field-select"
                      value={editPost.post_type}
                      onChange={e => setEditPost(p => ({ ...p, post_type: e.target.value }))}>
                      {POST_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Plataforma</label>
                    <select className="field-select"
                      value={editPost.platform}
                      onChange={e => setEditPost(p => ({ ...p, platform: e.target.value }))}>
                      {PLATFORMS.map(pl => (
                        <option key={pl.value} value={pl.value}>{pl.icon} {pl.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Product picker */}
                <label className="field-label">Producto (opcional)</label>
                <select className="field-select"
                  value={editPost.product_id || ''}
                  onChange={e => {
                    const p = products.find(x => x.id === e.target.value)
                    setEditPost(prev => ({
                      ...prev,
                      product_id: p?.id || undefined,
                      product_name: p?.name_es,
                      product_price: p?.price_mxn,
                    }))
                  }}>
                  <option value="">Sin producto específico</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name_es} — ${p.price_mxn}</option>
                  ))}
                </select>

                {/* Image note */}
                <label className="field-label">Nota de imagen / video</label>
                <input className="field-input"
                  value={editPost.image_note || ''}
                  onChange={e => setEditPost(p => ({ ...p, image_note: e.target.value }))}
                  placeholder="Ej: foto del grinder sobre fondo negro con humo..." />

                {/* Caption */}
                <div className="caption-label-row">
                  <label className="field-label">Caption</label>
                  <span className="char-count">
                    {(editPost.caption || '').length} / {CHAR_LIMITS[editPost.platform || 'instagram_feed']}
                  </span>
                </div>
                <textarea className="field-textarea caption-ta"
                  value={editPost.caption || ''}
                  onChange={e => setEditPost(p => ({ ...p, caption: e.target.value }))}
                  placeholder="Escribe el caption o genera uno con IA..."
                  rows={5}
                />

                {/* AI generate button */}
                <button className="btn-ai" onClick={generateCaption} disabled={generating}>
                  {generating ? '✨ Generando...' : '✨ Generar con IA'}
                </button>
                {editPost.ai_generated && (
                  <p className="ai-note">Caption generado con IA · revisa antes de publicar</p>
                )}

                {/* CTA */}
                <label className="field-label">CTA (call to action)</label>
                <input className="field-input"
                  value={editPost.cta || ''}
                  onChange={e => setEditPost(p => ({ ...p, cta: e.target.value }))}
                  placeholder="📲 Pide el tuyo → distritopipa.com" />

                {/* Hashtags */}
                <label className="field-label">Hashtags</label>
                <input className="field-input"
                  value={editPost.hashtags || ''}
                  onChange={e => setEditPost(p => ({ ...p, hashtags: e.target.value }))}
                  placeholder="#DistritoPipa #Cancún #AccesoriosPersonales" />

                {/* Disclaimer toggle */}
                <label className="toggle-row">
                  <span>Incluir disclaimer legal</span>
                  <input type="checkbox"
                    checked={editPost.include_disclaimer ?? true}
                    onChange={e => setEditPost(p => ({ ...p, include_disclaimer: e.target.checked }))} />
                </label>

                {/* Preview */}
                {editPost.caption && (
                  <div className="preview-box">
                    <div className="preview-label">Vista previa del caption completo</div>
                    <pre className="preview-text">{buildExportText(editPost as CampaignPost)}</pre>
                  </div>
                )}

                {/* Actions */}
                <div className="drawer-actions">
                  <button className="btn-copy" onClick={copyCaption}>
                    {copied ? '✓ Copiado' : '📋 Copiar'}
                  </button>
                  {editPost.id && (
                    <button className="btn-advance-status"
                      onClick={() => { advanceStatus(editPost as CampaignPost); setEditPost(null) }}
                      disabled={editPost.status === 'posted'}>
                      {editPost.status === 'draft' ? '✅ Marcar listo' :
                       editPost.status === 'ready' ? '🎉 Marcar publicado' : '✓ Publicado'}
                    </button>
                  )}
                  {editPost.id && (
                    <button className="btn-delete-post" onClick={() => deletePost(editPost.id!)}>
                      🗑️
                    </button>
                  )}
                  <button className="btn-save-post" onClick={savePost} disabled={saving}>
                    {saving ? 'Guardando...' : editPost.id ? 'Guardar cambios' : 'Crear post'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <>
          <div className="page-header">
            <div>
              <div className="page-eyebrow">Marketing</div>
              <h1 className="page-title">Campañas</h1>
            </div>
            <button className="btn-primary" onClick={() => setShowNewForm(true)}>+ Nueva campaña</button>
          </div>

          {/* New campaign form */}
          {showNewForm && (
            <div className="new-campaign-form">
              <div className="form-section-title">Nueva campaña</div>
              <label className="field-label">Nombre *</label>
              <input className="field-input"
                value={newCampaign.name}
                onChange={e => setNewCampaign(c => ({ ...c, name: e.target.value }))}
                placeholder="Ej: Septiembre Fumador, Navidad 2025" />
              <label className="field-label">Tema / concepto</label>
              <input className="field-input"
                value={newCampaign.theme}
                onChange={e => setNewCampaign(c => ({ ...c, theme: e.target.value }))}
                placeholder="Ej: Nuevos bongs de vidrio, Temporada fría" />
              <div className="field-row-2">
                <div>
                  <label className="field-label">Inicio *</label>
                  <input className="field-input" type="date"
                    value={newCampaign.start_date}
                    onChange={e => setNewCampaign(c => ({ ...c, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Fin *</label>
                  <input className="field-input" type="date"
                    value={newCampaign.end_date}
                    onChange={e => setNewCampaign(c => ({ ...c, end_date: e.target.value }))} />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn-ghost" onClick={() => setShowNewForm(false)}>Cancelar</button>
                <button className="btn-primary" onClick={createCampaign}>Crear campaña</button>
              </div>
            </div>
          )}

          {/* Campaign list */}
          <div className="campaign-list">
            {loading && <div className="loading">Cargando campañas...</div>}
            {!loading && campaigns.length === 0 && (
              <div className="empty">No hay campañas aún. Crea la primera.</div>
            )}
            {campaigns.map(c => (
              <div key={c.id} className="campaign-card" onClick={() => openCampaign(c)}>
                <div className="cc-head">
                  <div>
                    <div className="cc-name">{c.name}</div>
                    {c.theme && <div className="cc-theme">{c.theme}</div>}
                  </div>
                  <span className={`cc-status cc-${c.status}`}>{c.status}</span>
                </div>
                <div className="cc-dates">
                  {new Date(c.start_date + 'T12:00:00').toLocaleDateString('es-MX', { day:'numeric', month:'short' })}
                  {' → '}
                  {new Date(c.end_date + 'T12:00:00').toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' })}
                </div>
                <div className="cc-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${c.completion_pct || 0}%` }} />
                  </div>
                  <span className="progress-label">{c.completion_pct || 0}% publicado · {c.posted}/{c.total_posts} posts</span>
                </div>
                <div className="cc-stats">
                  <span className="cs-chip draft">{c.drafts} borradores</span>
                  <span className="cs-chip ready">{c.ready} listos</span>
                  <span className="cs-chip posted">{c.posted} publicados</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── CALENDAR VIEW ── */}
      {view === 'calendar' && activeCampaign && (
        <>
          <div className="page-header">
            <div>
              <button className="back-link" onClick={() => setView('list')}>← Campañas</button>
              <h1 className="page-title">{activeCampaign.name}</h1>
              {activeCampaign.theme && <div className="page-theme">{activeCampaign.theme}</div>}
            </div>
            <div className="cal-stats">
              <span className="cs-chip posted">{posts.filter(p=>p.status==='posted').length} publicados</span>
              <span className="cs-chip ready">{posts.filter(p=>p.status==='ready').length} listos</span>
              <span className="cs-chip draft">{posts.filter(p=>p.status==='draft').length} borradores</span>
            </div>
          </div>

          {/* Legend */}
          <div className="legend-row">
            {POST_TYPES.map(t => (
              <span key={t.value} className="legend-item">
                <span style={{ color: t.color }}>{t.icon}</span> {t.label}
              </span>
            ))}
          </div>

          {/* 8-week calendar */}
          <div className="calendar-wrap">
            {weeks.map(week => (
              <div key={week.weekNum} className="cal-week">
                <div className="week-header">
                  <span className="week-label">{week.label}</span>
                  <span className="week-count">
                    {posts.filter(p => p.week_number === week.weekNum).length} posts
                  </span>
                </div>

                <div className="week-days">
                  {week.dates.map(date => {
                    const post = getPost(date)
                    const dayNum = new Date(date + 'T12:00:00').getDate()
                    const dayName = new Date(date + 'T12:00:00').toLocaleDateString('es-MX', { weekday:'short' })
                    const typeConfig = POST_TYPES.find(t => t.value === post?.post_type)
                    const statusCfg = post ? STATUS_CONFIG[post.status as keyof typeof STATUS_CONFIG] : null

                    return (
                      <button key={date} className={`day-cell ${post ? 'has-post' : ''}`}
                        onClick={() => openPostEditor(date)}
                        style={post ? { borderColor: `${typeConfig?.color}44` } : {}}>
                        <div className="day-num-row">
                          <span className="day-num">{dayNum}</span>
                          <span className="day-name">{dayName}</span>
                        </div>
                        {post ? (
                          <div className="day-post">
                            <span className="day-post-icon">{typeConfig?.icon}</span>
                            <span className="day-post-type">{typeConfig?.label}</span>
                            <span className="day-platform">{PLATFORMS.find(pl => pl.value === post.platform)?.icon}</span>
                            <span className="day-status" style={{ color: statusCfg?.color }}>
                              {statusCfg?.label}
                            </span>
                            {post.product_name && (
                              <span className="day-product">{post.product_name}</span>
                            )}
                          </div>
                        ) : (
                          <div className="day-empty">
                            <span className="day-plus">+</span>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        .camps-page{min-height:100vh;background:#111;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding-bottom:60px}

        .toast{position:fixed;top:16px;right:16px;z-index:1000;background:#1a1a1a;border:1px solid #2a2a2a;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,.5);animation:slideIn .2s ease}
        @keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}

        /* Header */
        .page-header{display:flex;justify-content:space-between;align-items:flex-start;padding:28px 20px 16px;border-bottom:1px solid #2a2a2a;flex-wrap:wrap;gap:12px}
        .page-eyebrow{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px}
        .page-title{font-size:22px;font-weight:600;margin:0}
        .page-theme{font-size:13px;color:#888;margin-top:3px}
        .back-link{background:none;border:none;color:#888;font-size:12px;cursor:pointer;padding:0 0 4px;display:block}
        .back-link:hover{color:#fff}

        /* Buttons */
        .btn-primary{padding:9px 18px;background:#CC2222;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
        .btn-primary:hover{background:#e02222}
        .btn-ghost{padding:9px 14px;background:transparent;color:#888;border:0.5px solid #2a2a2a;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-ghost:hover{color:#fff}

        /* Campaign list */
        .campaign-list{display:flex;flex-direction:column;gap:10px;padding:16px 20px}
        .loading,.empty{padding:40px;text-align:center;color:#888;font-size:14px}

        .campaign-card{background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:10px;padding:16px;cursor:pointer;transition:border-color .15s}
        .campaign-card:hover{border-color:#CC2222}
        .cc-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
        .cc-name{font-size:15px;font-weight:600}
        .cc-theme{font-size:12px;color:#888;margin-top:2px;font-style:italic}
        .cc-status{font-size:10px;padding:3px 9px;border-radius:10px;text-transform:capitalize}
        .cc-active{background:rgba(74,222,128,.1);color:#4ade80;border:0.5px solid rgba(74,222,128,.3)}
        .cc-completed{background:rgba(96,165,250,.1);color:#60a5fa;border:0.5px solid rgba(96,165,250,.3)}
        .cc-paused{background:rgba(251,191,36,.1);color:#fbbf24;border:0.5px solid rgba(251,191,36,.3)}
        .cc-archived{background:#2a2a2a;color:#888;border:0.5px solid #2a2a2a}
        .cc-dates{font-size:12px;color:#888;margin-bottom:10px}
        .cc-progress{margin-bottom:8px}
        .progress-bar{height:4px;background:#2a2a2a;border-radius:2px;margin-bottom:4px}
        .progress-fill{height:100%;background:#CC2222;border-radius:2px;transition:width .3s ease}
        .progress-label{font-size:10px;color:#888}
        .cc-stats{display:flex;gap:6px;flex-wrap:wrap}

        .cs-chip{font-size:10px;padding:2px 8px;border-radius:10px}
        .cs-chip.draft{background:#2a2a2a;color:#888}
        .cs-chip.ready{background:rgba(96,165,250,.1);color:#60a5fa}
        .cs-chip.posted{background:rgba(74,222,128,.1);color:#4ade80}

        /* New campaign form */
        .new-campaign-form{background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:10px;padding:18px;margin:0 20px 16px}
        .form-section-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:12px}
        .form-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}

        /* Field styles */
        .field-label{display:block;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;margin-top:10px}
        .field-label:first-of-type{margin-top:0}
        .field-input,.field-select{width:100%;background:#111;border:0.5px solid #2a2a2a;border-radius:7px;color:#fff;padding:9px 12px;font-size:13px;font-family:inherit}
        .field-input:focus,.field-select:focus{outline:none;border-color:#CC2222}
        .field-textarea{width:100%;background:#111;border:0.5px solid #2a2a2a;border-radius:7px;color:#fff;padding:9px 12px;font-size:13px;font-family:inherit;resize:vertical}
        .field-textarea:focus{outline:none;border-color:#CC2222}
        .field-row-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}

        /* Legend */
        .legend-row{display:flex;gap:10px;padding:10px 20px;flex-wrap:wrap;border-bottom:0.5px solid #1a1a1a}
        .legend-item{font-size:11px;color:#888;display:flex;align-items:center;gap:4px}
        .cal-stats{display:flex;gap:6px;flex-wrap:wrap;align-self:center}

        /* Calendar */
        .calendar-wrap{padding:12px 20px;display:flex;flex-direction:column;gap:12px}

        .cal-week{background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:10px;overflow:hidden}
        .week-header{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:0.5px solid #2a2a2a}
        .week-label{font-size:12px;font-weight:600;color:#fff}
        .week-count{font-size:11px;color:#888}

        .week-days{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;padding:8px}

        .day-cell{background:#111;border:0.5px solid #2a2a2a;border-radius:7px;padding:6px;cursor:pointer;text-align:left;transition:border-color .15s;min-height:72px;display:flex;flex-direction:column;gap:3px}
        .day-cell:hover{border-color:#555}
        .day-cell.has-post{background:#0d0d0d}
        .day-num-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:3px}
        .day-num{font-size:11px;font-weight:500;color:#ccc}
        .day-name{font-size:9px;color:#555;text-transform:capitalize}

        .day-post{display:flex;flex-direction:column;gap:2px}
        .day-post-icon{font-size:14px;line-height:1}
        .day-post-type{font-size:9px;color:#ccc;font-weight:500}
        .day-platform{font-size:11px}
        .day-status{font-size:9px;font-weight:500}
        .day-product{font-size:8px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}

        .day-empty{flex:1;display:flex;align-items:center;justify-content:center}
        .day-plus{font-size:18px;color:#2a2a2a;line-height:1}
        .day-cell:hover .day-plus{color:#555}

        /* Post drawer */
        .drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:98;backdrop-filter:blur(3px)}
        .post-drawer{position:fixed;bottom:0;left:0;right:0;top:30%;background:#111;border-top:0.5px solid #2a2a2a;border-radius:16px 16px 0 0;z-index:99;display:flex;flex-direction:column;max-height:70vh}
        .drawer-handle-row{display:flex;justify-content:center;align-items:center;padding:10px 16px;position:relative;flex-shrink:0}
        .drawer-handle{width:36px;height:3px;background:#2a2a2a;border-radius:2px}
        .drawer-close{position:absolute;right:14px;background:none;border:none;color:#888;font-size:18px;cursor:pointer;padding:4px 8px}
        .drawer-close:hover{color:#fff}
        .drawer-scroll{flex:1;overflow-y:auto}
        .drawer-scroll::-webkit-scrollbar{width:4px}
        .drawer-scroll::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:2px}
        .drawer-inner{padding:0 16px 24px;display:flex;flex-direction:column;gap:0}

        .drawer-date-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-top:4px}
        .drawer-date{font-size:13px;font-weight:600;color:#fff;text-transform:capitalize}
        .drawer-status-pill{font-size:10px;padding:3px 10px;border-radius:10px;border:0.5px solid}

        .caption-label-row{display:flex;justify-content:space-between;align-items:center;margin-top:10px;margin-bottom:5px}
        .char-count{font-size:10px;color:#555}

        .caption-ta{min-height:100px}

        .btn-ai{width:100%;padding:10px;background:rgba(167,139,250,.1);color:#a78bfa;border:0.5px solid rgba(167,139,250,.3);border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;margin-top:8px;transition:background .15s}
        .btn-ai:hover:not(:disabled){background:rgba(167,139,250,.2)}
        .btn-ai:disabled{opacity:.5;cursor:not-allowed}
        .ai-note{font-size:10px;color:#555;margin-top:4px;font-style:italic}

        .toggle-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:0.5px solid #2a2a2a;font-size:12px;color:#ccc;margin-top:10px;cursor:pointer}
        .toggle-row input{accent-color:#CC2222}

        .preview-box{background:#0d0d0d;border:0.5px solid #2a2a2a;border-radius:7px;padding:12px;margin-top:12px}
        .preview-label{font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
        .preview-text{font-size:11px;color:#888;line-height:1.7;white-space:pre-wrap;word-break:break-word;font-family:'Courier New',monospace}

        .drawer-actions{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}
        .btn-copy{padding:9px 14px;background:#1a1a1a;color:#888;border:0.5px solid #2a2a2a;border-radius:7px;font-size:12px;cursor:pointer;transition:all .15s}
        .btn-copy:hover{color:#fff}
        .btn-advance-status{padding:9px 14px;background:rgba(74,222,128,.1);color:#4ade80;border:0.5px solid rgba(74,222,128,.3);border-radius:7px;font-size:12px;cursor:pointer;transition:background .15s}
        .btn-advance-status:disabled{opacity:.4;cursor:not-allowed}
        .btn-delete-post{padding:9px 12px;background:transparent;color:#f87171;border:0.5px solid rgba(248,113,113,.3);border-radius:7px;font-size:12px;cursor:pointer}
        .btn-save-post{flex:1;padding:9px;background:#CC2222;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer}
        .btn-save-post:hover{background:#e02222}
        .btn-save-post:disabled{opacity:.5;cursor:not-allowed}
      `}</style>
    </div>
  )
}
