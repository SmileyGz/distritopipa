'use client'
// app/admin/blog/page.tsx
// ─────────────────────────────────────────────────────────────
// Distrito Pipa — Gestor del Blog & CMS Editorial (Supabase)
// Alineado al Brand Board: Rojo Eléctrico #DC143C, Bebas Neue, Inter
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { savePostAction, deletePostAction } from './actions'
import nextDynamic from 'next/dynamic'
import toast from 'react-hot-toast'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'

const MDEditor = nextDynamic(() => import('@uiw/react-md-editor'), { ssr: false })

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zlhyelvzmwwtrjvhhhov.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy'
const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Constants & Official Brand Board Catalog ────────────────

const OFFICIAL_PRODUCT_SLUGS = [
  { slug: 'pipa-extra-chica-de-vidrio',                      name: 'Burbuja XS' },
  { slug: 'pipa-de-vidrio-sencilla-ch-m-g',                  name: 'Sencilla Clásica' },
  { slug: 'pipa-de-vidrio-reforzada-gruesa-accesorios-cancun', name: 'Reforzada Gruesa' },
  { slug: 'pipa-de-vidrio-de-colores-artesanal-distrito-pipa-cancun', name: 'Pipa de Colores' },
  { slug: 'pipa-de-vidrio-diseno-calavera-smoke-shop-cancun', name: 'Calavera Reforzada' },
  { slug: 'llavero-cenicero-portatil-discreto-accesorios-cancun', name: 'Llavero Cenicero' },
  { slug: 'herramienta-3-en-1-para-pipas-y-bongs-cancun',    name: 'Herramienta 3 en 1' },
  { slug: 'grinder-moledor-de-metal-acrilico-entrega-inmediata-cancun', name: 'Grinder Metálico/Acrílico' },
  { slug: 'papel-para-fumar-canalas-distrito-pipa-cancun',    name: 'Canalas / Sábanas' },
  { slug: 'filtros-tips-de-carton-vidrio-para-fumar-cancun',  name: 'Filtros / Tips' },
  { slug: 'bong-de-vidrio-18-cm-portatil-smoke-shop-local-cancun', name: 'Bong Reforzado 18cm' },
  { slug: 'bong-de-vidrio-20-cm-pipas-y-accesorios-cancun',   name: 'Bong 20cm' },
  { slug: 'bowl-reforzado-de-vidrio-para-bong-distrito-pipa-cancun', name: 'Bowl Reforzado' },
  { slug: 'repuesto-de-vidrio-reforzado-para-bongs-cancun',   name: 'Repuesto de Vidrio' },
  { slug: 'soplete-mini-recargable-a-prueba-de-viento-smoke-shop-cancun', name: 'Soplete Mini' },
  { slug: 'soplete-de-gas-butano-recargable-uso-rudo-distrito-pipa-cancun', name: 'Soplete Uso Rudo' },
  { slug: 'gas-butano-premium-para-sopletes-entrega-rapida-cancun', name: 'Gas Butano' },
]

const CONTENT_PILLARS = [
  { id: 'todos',     label: 'Todos los Artículos', icon: '📚' },
  { id: 'producto',  label: 'Producto',           icon: '🛍️', hint: 'Demos, grosor, resistencia, comparativas' },
  { id: 'social',    label: 'Prueba Social',      icon: '⭐', hint: 'Entregas en Cancún, reseñas, pedidos listos' },
  { id: 'comunidad', label: 'Comunidad Cancún',   icon: '🌴', hint: 'Región 96, avenidas, cultura local' },
  { id: 'mayoreo',   label: 'Reventa & Mayoreo',  icon: '📦', hint: 'Docenas, revendedores, márgenes' },
]

export type BlogPost = {
  id?: string
  slug: string
  title: string
  meta_description: string
  focus_keyword: string
  content: string
  published_at?: string
  image_url?: string
}

const EMPTY_POST: BlogPost = {
  slug: '',
  title: '',
  meta_description: '',
  focus_keyword: '',
  content: '',
  image_url: '',
}

export default function AdminBlog() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Filters & Search
  const [search, setSearch] = useState('')
  const [selectedPillar, setSelectedPillar] = useState('todos')
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'words'>('recent')

  // Modals & Selectors
  const [confirmDelete, setConfirmDelete] = useState<BlogPost | null>(null)
  const [selectedProductSlug, setSelectedProductSlug] = useState(OFFICIAL_PRODUCT_SLUGS[0].slug)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('published_at', { ascending: false })
      if (!error && data) {
        setPosts(data)
      }
    } catch {
      toast.error('Error al cargar artículos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // ─── Form Handlers ───────────────────────────────────────────

  const handleContentChange = useCallback((val: string | undefined) => {
    setEditingPost(prev => (prev ? { ...prev, content: val || '' } : null))
  }, [])

  function openNewPost() {
    setEditingPost({ ...EMPTY_POST })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openEditPost(post: BlogPost) {
    setEditingPost({ ...post })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleTitleChange(val: string) {
    if (!editingPost) return
    const isNew = !editingPost.id
    let newSlug = editingPost.slug
    if (isNew || !editingPost.slug) {
      newSlug = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
    }
    setEditingPost({ ...editingPost, title: val, slug: newSlug })
  }

  // ─── Module Inserters ────────────────────────────────────────

  function insertProductBlock(slugToInsert?: string) {
    if (!editingPost) return
    const slug = slugToInsert || selectedProductSlug
    const block = `\n\n\`\`\`product\n${slug}\n\`\`\`\n\n`
    setEditingPost({
      ...editingPost,
      content: (editingPost.content || '') + block,
    })
    toast.success(`Módulo de producto agregado: ${slug}`)
  }

  function insertCtaBlock() {
    if (!editingPost) return
    const block = `\n\n\`\`\`cta\ncatalogo\n¡Explora nuestro catálogo completo y recibe tu pedido hoy mismo en Cancún!\n\`\`\`\n\n`
    setEditingPost({
      ...editingPost,
      content: (editingPost.content || '') + block,
    })
    toast.success('Banner CTA de catálogo insertado')
  }

  function insertSnippet(snippet: string) {
    if (!editingPost) return
    setEditingPost({
      ...editingPost,
      content: (editingPost.content || '') + snippet,
    })
  }

  // ─── Image Upload ────────────────────────────────────────────

  async function handleImageUpload(file: File) {
    if (!file || !editingPost) return
    setUploadingImage(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('category', 'blog')

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.url) {
        setEditingPost({ ...editingPost, image_url: data.url })
        toast.success('Fotografía de portada subida con éxito')
      } else {
        toast.error(data.error || 'Error al subir la imagen')
      }
    } catch {
      toast.error('Error de conexión al subir la imagen')
    } finally {
      setUploadingImage(false)
    }
  }

  // ─── Save & Delete Actions ───────────────────────────────────

  async function savePost(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPost) return

    if (!editingPost.title.trim()) {
      toast.error('El título es requerido')
      return
    }
    if (!editingPost.slug.trim()) {
      toast.error('El slug (URL) es requerido')
      return
    }
    if (!editingPost.meta_description.trim()) {
      toast.error('La meta descripción SEO es requerida')
      return
    }

    setSaving(true)
    const postToSave = { ...editingPost }
    if (!postToSave.id) delete postToSave.id

    const res = await savePostAction(postToSave)

    if (!res.success) {
      toast.error('Error guardando: ' + res.error)
    } else {
      toast.success('✅ ¡Artículo guardado y publicado con éxito!')
      setEditingPost(null)
      fetchPosts()
    }
    setSaving(false)
  }

  async function handleDelete(slug: string) {
    if (!confirmDelete) return
    const res = await deletePostAction(slug)
    if (res.success) {
      toast.success('🗑️ Artículo eliminado')
      setConfirmDelete(null)
      fetchPosts()
    } else {
      toast.error('Error eliminando: ' + res.error)
    }
  }

  // ─── Clipboard Helpers ───────────────────────────────────────

  function copyPostLink(slug: string, e: React.MouseEvent) {
    e.stopPropagation()
    const url = `https://www.distritopipa.com/blog/${slug}`
    navigator.clipboard.writeText(url)
    toast.success('📋 Enlace público copiado al portapapeles')
  }

  // ─── Analytics & Metrics Calculations ────────────────────────

  const stats = useMemo(() => {
    const total = posts.length
    const withKeyword = posts.filter(p => p.focus_keyword?.trim()).length
    
    // Average reading time
    let totalWords = 0
    posts.forEach(p => {
      const words = (p.content || '').trim().split(/\s+/).filter(Boolean).length
      totalWords += words
    })
    const avgWords = total > 0 ? Math.round(totalWords / total) : 0
    const avgReadingMins = Math.max(1, Math.round(avgWords / 200))

    // Count conversion modules across posts
    let totalProductBlocks = 0
    let totalCtaBlocks = 0
    posts.forEach(p => {
      totalProductBlocks += (p.content?.match(/```product/g) || []).length
      totalCtaBlocks += (p.content?.match(/```cta/g) || []).length
    })

    return { total, withKeyword, avgReadingMins, totalProductBlocks, totalCtaBlocks }
  }, [posts])

  // ─── Filtered and Sorted Posts ───────────────────────────────

  const filteredPosts = useMemo(() => {
    const q = search.toLowerCase().trim()
    return posts
      .filter(p => {
        const matchesSearch =
          !q ||
          p.title?.toLowerCase().includes(q) ||
          p.slug?.toLowerCase().includes(q) ||
          p.focus_keyword?.toLowerCase().includes(q) ||
          p.meta_description?.toLowerCase().includes(q)

        return matchesSearch
      })
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title)
        if (sortBy === 'words') {
          const wA = (a.content || '').split(/\s+/).length
          const wB = (b.content || '').split(/\s+/).length
          return wB - wA
        }
        return (
          new Date(b.published_at || 0).getTime() -
          new Date(a.published_at || 0).getTime()
        )
      })
  }, [posts, search, sortBy])

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="admin-page">
      {/* Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap"
      />

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="modal-title">¿Eliminar artículo del Blog?</h3>
            <p className="modal-text">
              Estás a punto de eliminar permanentemente el artículo <strong>&ldquo;{confirmDelete.title}&rdquo;</strong> (/blog/{confirmDelete.slug}). Esta acción desindexará la URL y no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button
                className="btn-danger"
                onClick={() => handleDelete(confirmDelete.slug)}
              >
                Sí, eliminar artículo
              </button>
              <button
                className="btn-secondary"
                onClick={() => setConfirmDelete(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="page-header">
        <div className="header-titles">
          <span className="page-eyebrow">CMS Editorial & Conversión</span>
          <h1 className="page-title">Gestor del Blog</h1>
        </div>

        <div className="header-actions">
          <a
            href="/blog"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            title="Ver el blog público de Distrito Pipa en una nueva pestaña"
          >
            📰 Ver Blog en Vivo ↗
          </a>

          {!editingPost && (
            <button className="btn-primary" onClick={openNewPost}>
              + Crear Nuevo Artículo
            </button>
          )}
        </div>
      </header>

      {/* ─── LIST VIEW ─── */}
      {!editingPost ? (
        <div className="blog-content">
          {/* KPI Stats Bar */}
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Artículos Publicados</span>
              <span className="stat-val">{stats.total}</span>
              <span className="stat-sub">En la base de datos</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Enfoque SEO Activo</span>
              <span className="stat-val text-green">{stats.withKeyword}</span>
              <span className="stat-sub">Con palabra clave definida</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Lectura Promedio</span>
              <span className="stat-val text-gold">~{stats.avgReadingMins} min</span>
              <span className="stat-sub">Velocidad de consumo</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Conversión al Catálogo</span>
              <span className="stat-val text-red">
                {stats.totalProductBlocks + stats.totalCtaBlocks}
              </span>
              <span className="stat-sub">
                {stats.totalProductBlocks} productos · {stats.totalCtaBlocks} CTAs
              </span>
            </div>
          </div>

          {/* Control Bar: Search, Pillars, Sorting */}
          <div className="control-bar">
            <div className="search-sort-row">
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  className="search-input"
                  placeholder="Buscar artículos por título, slug o palabra clave..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button className="clear-btn" onClick={() => setSearch('')}>
                    ✕
                  </button>
                )}
              </div>

              <div className="sort-box">
                <span className="sort-label">Ordenar:</span>
                <select
                  className="sort-select"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                >
                  <option value="recent">🕒 Más recientes</option>
                  <option value="title">🔤 Título (A - Z)</option>
                  <option value="words">📝 Longitud (Palabras)</option>
                </select>
              </div>
            </div>

            {/* Content Pillars Tabs */}
            <div className="pillars-tabs">
              {CONTENT_PILLARS.map(p => (
                <button
                  key={p.id}
                  className={`pillar-tab ${selectedPillar === p.id ? 'active' : ''}`}
                  onClick={() => setSelectedPillar(p.id)}
                  title={p.hint}
                >
                  <span>{p.icon}</span> {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Articles List */}
          <div className="articles-list-container">
            {loading && <div className="state-notice">Cargando biblioteca editorial de Distrito Pipa...</div>}

            {!loading && filteredPosts.length === 0 && (
              <div className="empty-state-box">
                <p className="empty-title">No se encontraron artículos.</p>
                <p className="empty-desc">
                  {search
                    ? 'No hay artículos que coincidan con la búsqueda. Intenta con otros términos.'
                    : 'Aún no hay artículos publicados. ¡Comienza a redactar el primero!'}
                </p>
                <button className="btn-primary" onClick={openNewPost}>
                  + Redactar Primer Artículo
                </button>
              </div>
            )}

            {!loading && filteredPosts.length > 0 && (
              <div className="posts-grid">
                {filteredPosts.map(post => {
                  const words = (post.content || '').trim().split(/\s+/).filter(Boolean).length
                  const readMins = Math.max(1, Math.round(words / 200))
                  const productBlocksCount = (post.content?.match(/```product/g) || []).length
                  const ctaBlocksCount = (post.content?.match(/```cta/g) || []).length

                  return (
                    <article key={post.slug} className="post-card">
                      <div className="post-card-thumb">
                        {post.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={post.image_url}
                            alt={post.title}
                            className="post-thumb-img"
                          />
                        ) : (
                          <div className="post-thumb-fallback">
                            <span className="dp-badge">DP</span>
                          </div>
                        )}
                        <span className="read-badge">⚡ ~{readMins} min</span>
                      </div>

                      <div className="post-card-body">
                        <div className="post-meta-top">
                          <span className="slug-tag">/blog/{post.slug}</span>
                          {post.focus_keyword && (
                            <span className="keyword-chip" title="Focus Keyword SEO">
                              🎯 {post.focus_keyword}
                            </span>
                          )}
                        </div>

                        <h3 className="post-card-title">{post.title}</h3>

                        <p className="post-card-desc">
                          {post.meta_description || 'Sin descripción SEO configurada.'}
                        </p>

                        <div className="conversion-chips">
                          {productBlocksCount > 0 && (
                            <span className="conv-chip product">
                              🛍️ {productBlocksCount} {productBlocksCount === 1 ? 'Producto' : 'Productos'}
                            </span>
                          )}
                          {ctaBlocksCount > 0 && (
                            <span className="conv-chip cta">
                              🔴 {ctaBlocksCount} {ctaBlocksCount === 1 ? 'CTA Catálogo' : 'CTAs Catálogo'}
                            </span>
                          )}
                          <span className="conv-chip words">
                            📝 {words} palabras
                          </span>
                        </div>
                      </div>

                      {/* Card Action Strip */}
                      <div className="post-card-actions">
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-card-action"
                          title="Ver artículo público en vivo"
                        >
                          👁️ Ver en Vivo ↗
                        </a>

                        <button
                          className="btn-card-action"
                          onClick={e => copyPostLink(post.slug, e)}
                          title="Copiar link para redes sociales o WhatsApp"
                        >
                          📋 Copiar Enlace
                        </button>

                        <div className="ml-auto-actions">
                          <button
                            className="btn-card-edit"
                            onClick={() => openEditPost(post)}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            className="btn-card-del"
                            onClick={() => setConfirmDelete(post)}
                            title="Eliminar artículo"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── FORM VIEW (CREATE / EDIT) ─── */
        <div className="editor-container">
          <form onSubmit={savePost}>
            {/* Top Editor Bar */}
            <div className="editor-top-bar">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditingPost(null)}
              >
                ← Volver a Lista
              </button>

              <div className="editor-title-center">
                <span className="editor-mode-label">
                  {editingPost.id ? 'Editando Artículo' : 'Nuevo Artículo'}
                </span>
                <span className="editor-slug-preview">
                  distritopipa.com/blog/<strong>{editingPost.slug || 'mi-articulo'}</strong>
                </span>
              </div>

              <div className="editor-save-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setEditingPost(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving || uploadingImage}
                >
                  {saving ? 'Guardando...' : 'Guardar y Publicar en Vivo'}
                </button>
              </div>
            </div>

            <div className="editor-two-cols">
              {/* Left Column: Metadata & Markdown Content */}
              <div className="editor-main-col">
                {/* Basic Metadata Card */}
                <div className="editor-card">
                  <h3 className="card-section-title">1. Título & Identificador</h3>

                  <div className="field-group">
                    <div className="label-with-counter">
                      <label className="field-label">Título del Artículo *</label>
                      <span className={`counter-badge ${editingPost.title.length > 65 ? 'warning' : ''}`}>
                        {editingPost.title.length}/60 car.
                      </span>
                    </div>
                    <input
                      required
                      type="text"
                      className="field-input text-bold"
                      value={editingPost.title}
                      onChange={e => handleTitleChange(e.target.value)}
                      placeholder="Ej: ¿Dónde comprar pipas de vidrio artesanales en Cancún?"
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label">Slug de la URL (Identificador) *</label>
                    <div className="slug-wrapper">
                      <span className="slug-lead">distritopipa.com/blog/</span>
                      <input
                        required
                        type="text"
                        className="slug-field"
                        value={editingPost.slug}
                        onChange={e => setEditingPost({ ...editingPost, slug: e.target.value })}
                        placeholder="donde-comprar-pipas-vidrio-cancun"
                      />
                    </div>
                  </div>

                  <div className="field-group">
                    <label className="field-label">Palabra Clave Objetivo (Focus Keyword)</label>
                    <input
                      type="text"
                      className="field-input"
                      value={editingPost.focus_keyword}
                      onChange={e => setEditingPost({ ...editingPost, focus_keyword: e.target.value })}
                      placeholder="Ej: pipas de vidrio Cancún"
                    />
                    <p className="field-subnote">
                      La palabra clave principal por la que los cancunenses encontrarán este artículo en Google.
                    </p>
                  </div>
                </div>

                {/* Conversion Toolbar & Markdown Card */}
                <div className="editor-card">
                  <div className="card-header-flex">
                    <h3 className="card-section-title">2. Contenido del Artículo & Módulos de Conversión</h3>
                    <span className="badge-rule">Brand Board Rule</span>
                  </div>

                  {/* Brand Board Conversion Toolbar */}
                  <div className="conversion-toolbar">
                    <div className="ct-group">
                      <span className="ct-label">🛍️ Insertar Producto:</span>
                      <select
                        className="ct-select"
                        value={selectedProductSlug}
                        onChange={e => setSelectedProductSlug(e.target.value)}
                      >
                        {OFFICIAL_PRODUCT_SLUGS.map(p => (
                          <option key={p.slug} value={p.slug}>
                            {p.name} ({p.slug.slice(0, 24)}...)
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="ct-btn-primary"
                        onClick={() => insertProductBlock()}
                      >
                        + Inyectar Tarjeta
                      </button>
                    </div>

                    <div className="ct-group">
                      <button
                        type="button"
                        className="ct-btn-cta"
                        onClick={insertCtaBlock}
                      >
                        🔴 + Banner Catálogo (CTA)
                      </button>
                    </div>

                    <div className="ct-snippets">
                      <button
                        type="button"
                        className="ct-btn-snippet"
                        onClick={() => insertSnippet('\n\n## Subtítulo Aquí\n\n')}
                      >
                        H2
                      </button>
                      <button
                        type="button"
                        className="ct-btn-snippet"
                        onClick={() => insertSnippet('\n\n### Sección Menor\n\n')}
                      >
                        H3
                      </button>
                      <button
                        type="button"
                        className="ct-btn-snippet"
                        onClick={() => insertSnippet('**texto resaltado**')}
                      >
                        B
                      </button>
                      <button
                        type="button"
                        className="ct-btn-snippet"
                        onClick={() => insertSnippet('\n- Elemento de lista')}
                      >
                        • Lista
                      </button>
                    </div>
                  </div>

                  {/* Golden Rule Alert */}
                  <div className="golden-rule-callout">
                    <span className="gr-icon">⚠️</span>
                    <span className="gr-text">
                      <strong>Regla de Oro del Brand Board:</strong> JAMÁS insertes enlaces que dirijan a WhatsApp a tráfico público. Todo el tráfico del blog debe dirigirse al catálogo web. WhatsApp es exclusivo para confirmación y cierre de pedidos.
                    </span>
                  </div>

                  {/* Markdown Editor Component */}
                  <div data-color-mode="dark" className="md-editor-wrapper">
                    <MDEditor
                      value={editingPost.content}
                      onChange={handleContentChange}
                      height={600}
                      preview="live"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: SEO Assistant & Cover Image */}
              <div className="editor-side-col">
                {/* Cover Image Card */}
                <div className="editor-card">
                  <h3 className="card-section-title">3. Imagen de Portada</h3>
                  <p className="field-subnote">
                    Recomendado 1200 × 630 px (formato horizontal para Google y OpenGraph).
                  </p>

                  {editingPost.image_url ? (
                    <div className="cover-preview-wrapper">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={editingPost.image_url}
                        alt="Portada"
                        className="cover-preview-img"
                      />
                      <button
                        type="button"
                        className="remove-cover-btn"
                        onClick={() => setEditingPost({ ...editingPost, image_url: '' })}
                        title="Eliminar imagen"
                      >
                        ✕ Quitar Imagen
                      </button>
                    </div>
                  ) : (
                    <div
                      className="cover-drop-zone"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingImage ? (
                        <span>Subiendo fotografía a Supabase...</span>
                      ) : (
                        <>
                          <span className="upload-icon">📷</span>
                          <span className="upload-label">Haz clic para subir portada</span>
                          <span className="upload-hint">PNG, JPG o WEBP</span>
                        </>
                      )}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleImageUpload(file)
                    }}
                  />

                  <div className="manual-url-box">
                    <label className="field-label-tiny">O escribe la URL directamente:</label>
                    <input
                      type="text"
                      className="field-input-sm"
                      value={editingPost.image_url || ''}
                      onChange={e => setEditingPost({ ...editingPost, image_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* SEO Assistant Card */}
                <div className="editor-card">
                  <h3 className="card-section-title">4. Asistente SEO para Google</h3>

                  <div className="field-group">
                    <div className="label-with-counter">
                      <label className="field-label">Meta Descripción (Snippet Google) *</label>
                      <span
                        className={`counter-badge ${
                          editingPost.meta_description.length >= 130 &&
                          editingPost.meta_description.length <= 160
                            ? 'ideal'
                            : editingPost.meta_description.length > 160
                            ? 'warning'
                            : ''
                        }`}
                      >
                        {editingPost.meta_description.length}/155 car.
                      </span>
                    </div>
                    <textarea
                      required
                      className="field-textarea"
                      rows={3}
                      value={editingPost.meta_description}
                      onChange={e => setEditingPost({ ...editingPost, meta_description: e.target.value })}
                      placeholder="Resumen atractivo para que el usuario haga clic en Google (Ideal 140 a 160 caracteres)."
                    />
                  </div>

                  {/* Google Search Result Mock Preview */}
                  <div className="google-serp-preview">
                    <div className="serp-top">Vista previa en Google</div>
                    <div className="serp-url">
                      https://distritopipa.com/blog/{editingPost.slug || 'slug'}
                    </div>
                    <div className="serp-title">
                      {editingPost.title || 'Título del Artículo'} | Cultura Distrito Pipa Cancún
                    </div>
                    <div className="serp-desc">
                      {editingPost.meta_description || 'Descripción del artículo en los resultados de Google...'}
                    </div>
                  </div>

                  {/* Content Checklist */}
                  <div className="seo-checklist">
                    <div className="checklist-item">
                      <span>{editingPost.title.length >= 20 && editingPost.title.length <= 70 ? '✅' : '⚪'}</span>
                      <span>Título optimizado ({editingPost.title.length} car.)</span>
                    </div>
                    <div className="checklist-item">
                      <span>{editingPost.meta_description.length >= 120 && editingPost.meta_description.length <= 165 ? '✅' : '⚪'}</span>
                      <span>Meta descripción en rango ({editingPost.meta_description.length}/155 car.)</span>
                    </div>
                    <div className="checklist-item">
                      <span>{editingPost.focus_keyword && editingPost.title.toLowerCase().includes(editingPost.focus_keyword.toLowerCase()) ? '✅' : '⚪'}</span>
                      <span>Keyword incluida en el título</span>
                    </div>
                    <div className="checklist-item">
                      <span>{(editingPost.content || '').includes('```product') ? '✅' : '⚪'}</span>
                      <span>Módulo de producto integrado</span>
                    </div>
                    <div className="checklist-item">
                      <span>{(editingPost.content || '').includes('```cta') ? '✅' : '⚪'}</span>
                      <span>Llamado a la acción (CTA) incluido</span>
                    </div>
                  </div>
                </div>

                {/* 5 Content Pillars Quick Reference */}
                <div className="editor-card pillars-guide-card">
                  <h3 className="card-section-title text-gold">🧠 5 Pilares de Contenido</h3>
                  <div className="pillars-mini-list">
                    <div className="pml-item">
                      <strong>1. Producto:</strong> Fotos, demos de grosor y resistencia.
                    </div>
                    <div className="pml-item">
                      <strong>2. Prueba Social:</strong> Pedidos entregados en Cancún.
                    </div>
                    <div className="pml-item">
                      <strong>3. Entretenimiento:</strong> Humor local y anécdotas urbanas.
                    </div>
                    <div className="pml-item">
                      <strong>4. Comunidad:</strong> Referencias a Región 96 y avenidas.
                    </div>
                    <div className="pml-item">
                      <strong>5. Reventa:</strong> Opciones para revendedores y mayoreo.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Bottom Save Strip */}
            <div className="sticky-editor-footer">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditingPost(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving || uploadingImage}
              >
                {saving ? 'Guardando en Supabase...' : 'Guardar y Publicar en Vivo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── STYLES (BRAND BOARD) ── */}
      <style jsx>{`
        /* ── Base ─────────────────────────────────────────────── */
        .admin-page {
          min-height: 100vh;
          background: #111111;
          color: #f3f4f6;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          padding-bottom: 80px;
        }

        /* ── Header ───────────────────────────────────────────── */
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 32px;
          background: #161616;
          border-bottom: 1px solid #262626;
          gap: 16px;
          flex-wrap: wrap;
        }

        .header-titles {
          display: flex;
          flex-direction: column;
        }

        .page-eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #DC143C;
          font-weight: 700;
        }

        .page-title {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 32px;
          margin: 0;
          letter-spacing: 0.04em;
          color: #ffffff;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* ── KPI Grid ─────────────────────────────────────────── */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
          padding: 24px 32px 16px;
        }

        .stat-card {
          background: #1a1a1a;
          border: 1px solid #262626;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #888;
        }

        .stat-val {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 32px;
          line-height: 1;
          color: #fff;
        }

        .stat-sub {
          font-size: 11px;
          color: #666;
        }

        .text-green { color: #4ade80 !important; }
        .text-gold { color: #fbbf24 !important; }
        .text-red { color: #DC143C !important; }

        /* ── Control Bar ──────────────────────────────────────── */
        .control-bar {
          padding: 8px 32px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .search-sort-row {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .search-box {
          position: relative;
          flex: 1;
          min-width: 260px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 14px;
          color: #666;
        }

        .search-input {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #262626;
          border-radius: 8px;
          color: #fff;
          padding: 10px 14px 10px 36px;
          font-size: 13px;
          font-family: inherit;
        }

        .search-input:focus {
          outline: none;
          border-color: #DC143C;
        }

        .clear-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
        }

        .sort-box {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sort-label {
          font-size: 12px;
          color: #888;
        }

        .sort-select {
          background: #1a1a1a;
          border: 1px solid #262626;
          color: #fff;
          font-size: 12px;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
        }

        .pillars-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .pillar-tab {
          background: transparent;
          border: 1px solid #262626;
          color: #888;
          font-size: 12px;
          padding: 6px 14px;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
        }

        .pillar-tab:hover {
          color: #fff;
          border-color: #444;
          background: #1a1a1a;
        }

        .pillar-tab.active {
          background: #DC143C;
          border-color: #DC143C;
          color: #fff;
          font-weight: 600;
        }

        /* ── Posts List ───────────────────────────────────────── */
        .articles-list-container {
          padding: 0 32px;
        }

        .state-notice {
          text-align: center;
          padding: 60px 0;
          color: #888;
        }

        .empty-state-box {
          text-align: center;
          padding: 60px 20px;
          background: #1a1a1a;
          border: 1px dashed #333;
          border-radius: 12px;
          margin-top: 10px;
        }

        .empty-title {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 6px;
        }

        .empty-desc {
          font-size: 13px;
          color: #888;
          max-width: 450px;
          margin: 0 auto 20px;
          line-height: 1.5;
        }

        .posts-grid {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .post-card {
          background: #1a1a1a;
          border: 1px solid #262626;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.15s;
        }

        .post-card:hover {
          border-color: #383838;
          background: #1d1d1d;
        }

        .post-card-thumb {
          position: relative;
          width: 100%;
          height: 140px;
          border-radius: 8px;
          overflow: hidden;
          background: #111;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (min-width: 768px) {
          .post-card {
            flex-direction: row;
            align-items: center;
          }
          .post-card-thumb {
            width: 160px;
            height: 100px;
            flex-shrink: 0;
          }
        }

        .post-thumb-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .post-thumb-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background: #181818;
        }

        .dp-badge {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 28px;
          color: #DC143C;
          border: 2px solid #DC143C;
          padding: 2px 10px;
          border-radius: 6px;
        }

        .read-badge {
          position: absolute;
          bottom: 6px;
          right: 6px;
          background: rgba(0, 0, 0, 0.85);
          color: #fbbf24;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .post-card-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .post-meta-top {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .slug-tag {
          font-size: 11px;
          color: #60a5fa;
          background: rgba(96, 165, 250, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .keyword-chip {
          font-size: 11px;
          color: #4ade80;
          background: rgba(74, 222, 128, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .post-card-title {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .post-card-desc {
          font-size: 12.5px;
          color: #888;
          margin: 0;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .conversion-chips {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .conv-chip {
          font-size: 10.5px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .conv-chip.product {
          background: rgba(220, 20, 60, 0.12);
          color: #ff6b81;
          border: 1px solid rgba(220, 20, 60, 0.3);
        }

        .conv-chip.cta {
          background: rgba(251, 191, 36, 0.12);
          color: #fbbf24;
          border: 1px solid rgba(251, 191, 36, 0.3);
        }

        .conv-chip.words {
          background: #242424;
          color: #999;
        }

        .post-card-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          border-top: 1px solid #242424;
          padding-top: 10px;
        }

        @media (min-width: 768px) {
          .post-card-actions {
            border-top: none;
            padding-top: 0;
            padding-left: 16px;
            border-left: 1px solid #242424;
            flex-direction: column;
            align-items: stretch;
            min-width: 140px;
          }
        }

        .btn-card-action {
          background: #242424;
          border: 1px solid #333;
          color: #ccc;
          font-size: 11.5px;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          text-decoration: none;
          text-align: center;
          transition: all 0.15s;
        }

        .btn-card-action:hover {
          background: #333;
          color: #fff;
        }

        .ml-auto-actions {
          display: flex;
          gap: 6px;
          margin-left: auto;
        }

        @media (min-width: 768px) {
          .ml-auto-actions {
            margin-left: 0;
            width: 100%;
          }
        }

        .btn-card-edit {
          flex: 1;
          background: #DC143C;
          border: none;
          color: #fff;
          font-size: 11.5px;
          font-weight: 600;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .btn-card-edit:hover {
          background: #b90f32;
        }

        .btn-card-del {
          background: #242424;
          border: 1px solid #333;
          color: #888;
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
        }

        .btn-card-del:hover {
          color: #f87171;
          border-color: #f87171;
          background: rgba(248, 113, 113, 0.1);
        }

        /* ── Editor View ──────────────────────────────────────── */
        .editor-container {
          padding: 0 32px;
        }

        .editor-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0;
          border-bottom: 1px solid #262626;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .editor-title-center {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .editor-mode-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #DC143C;
          letter-spacing: 0.08em;
        }

        .editor-slug-preview {
          font-size: 13px;
          color: #888;
        }

        .editor-slug-preview strong {
          color: #60a5fa;
        }

        .editor-save-actions {
          display: flex;
          gap: 10px;
        }

        .editor-two-cols {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }

        @media (min-width: 1024px) {
          .editor-two-cols {
            grid-template-columns: 1fr 340px;
          }
        }

        .editor-main-col, .editor-side-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .editor-card {
          background: #1a1a1a;
          border: 1px solid #262626;
          border-radius: 12px;
          padding: 20px;
        }

        .card-header-flex {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .card-section-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #DC143C;
          margin: 0 0 14px 0;
        }

        .card-header-flex .card-section-title {
          margin: 0;
        }

        .badge-rule {
          font-size: 10px;
          background: rgba(220, 20, 60, 0.15);
          color: #ff6b81;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .field-group {
          margin-bottom: 14px;
        }

        .field-group:last-child {
          margin-bottom: 0;
        }

        .label-with-counter {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .field-label {
          font-size: 12px;
          font-weight: 600;
          color: #ccc;
          margin-bottom: 6px;
          display: block;
        }

        .label-with-counter .field-label {
          margin-bottom: 0;
        }

        .field-label-tiny {
          font-size: 11px;
          color: #777;
          display: block;
          margin-bottom: 4px;
        }

        .counter-badge {
          font-size: 10.5px;
          color: #888;
        }

        .counter-badge.ideal {
          color: #4ade80;
          font-weight: 700;
        }

        .counter-badge.warning {
          color: #f87171;
          font-weight: 700;
        }

        .field-input, .field-textarea {
          width: 100%;
          background: #111;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          color: #fff;
          padding: 10px 12px;
          font-size: 13px;
          font-family: inherit;
          transition: border-color 0.15s;
        }

        .field-input.text-bold {
          font-size: 15px;
          font-weight: 600;
        }

        .field-input:focus, .field-textarea:focus {
          outline: none;
          border-color: #DC143C;
        }

        .field-input-sm {
          width: 100%;
          background: #111;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          color: #fff;
          padding: 6px 10px;
          font-size: 11.5px;
        }

        .field-input-sm:focus {
          outline: none;
          border-color: #DC143C;
        }

        .field-subnote {
          font-size: 11px;
          color: #666;
          margin-top: 4px;
          line-height: 1.4;
        }

        .slug-wrapper {
          display: flex;
          align-items: center;
          background: #111;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          overflow: hidden;
        }

        .slug-lead {
          font-size: 12px;
          color: #666;
          padding: 8px 10px;
          background: #151515;
          border-right: 1px solid #262626;
        }

        .slug-field {
          flex: 1;
          background: transparent;
          border: none;
          color: #60a5fa;
          padding: 8px 10px;
          font-size: 12.5px;
          font-family: inherit;
        }

        .slug-field:focus {
          outline: none;
        }

        /* ── Conversion Toolbar ───────────────────────────────── */
        .conversion-toolbar {
          background: #141414;
          border: 1px solid #262626;
          border-radius: 8px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .ct-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ct-label {
          font-size: 11px;
          font-weight: 600;
          color: #ccc;
        }

        .ct-select {
          background: #111;
          border: 1px solid #333;
          color: #fff;
          font-size: 11.5px;
          padding: 6px 8px;
          border-radius: 6px;
          max-width: 170px;
        }

        .ct-btn-primary {
          background: #DC143C;
          border: none;
          color: #fff;
          font-size: 11.5px;
          font-weight: 600;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
        }

        .ct-btn-primary:hover {
          background: #b90f32;
        }

        .ct-btn-cta {
          background: rgba(220, 20, 60, 0.15);
          border: 1px solid #DC143C;
          color: #ff6b81;
          font-size: 11.5px;
          font-weight: 600;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
        }

        .ct-btn-cta:hover {
          background: #DC143C;
          color: #fff;
        }

        .ct-snippets {
          display: flex;
          gap: 4px;
          margin-left: auto;
        }

        .ct-btn-snippet {
          background: #242424;
          border: 1px solid #333;
          color: #ccc;
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
        }

        .ct-btn-snippet:hover {
          color: #fff;
          background: #333;
        }

        .golden-rule-callout {
          background: rgba(245, 158, 11, 0.08);
          border-left: 3px solid #f59e0b;
          border-radius: 6px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          font-size: 11.5px;
          color: #ddd;
        }

        .golden-rule-callout strong {
          color: #fbbf24;
        }

        .gr-icon {
          font-size: 14px;
        }

        .md-editor-wrapper {
          border-radius: 8px;
          overflow: hidden;
        }

        /* ── Side Column Helpers ──────────────────────────────── */
        .cover-preview-wrapper {
          position: relative;
          width: 100%;
          border-radius: 8px;
          overflow: hidden;
          background: #111;
          margin-bottom: 8px;
        }

        .cover-preview-img {
          width: 100%;
          max-height: 180px;
          object-fit: cover;
          display: block;
        }

        .remove-cover-btn {
          width: 100%;
          background: #242424;
          border: 1px solid #333;
          color: #f87171;
          font-size: 11px;
          padding: 6px;
          cursor: pointer;
          border-radius: 0 0 8px 8px;
        }

        .remove-cover-btn:hover {
          background: rgba(248, 113, 113, 0.1);
        }

        .cover-drop-zone {
          border: 2px dashed #333;
          border-radius: 8px;
          padding: 24px;
          text-align: center;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          background: #141414;
          margin-bottom: 10px;
          transition: border-color 0.15s;
        }

        .cover-drop-zone:hover {
          border-color: #DC143C;
        }

        .upload-icon {
          font-size: 24px;
        }

        .upload-label {
          font-size: 12px;
          font-weight: 600;
          color: #fff;
        }

        .upload-hint {
          font-size: 10.5px;
          color: #666;
        }

        .manual-url-box {
          margin-top: 10px;
        }

        /* SERP Mock Preview */
        .google-serp-preview {
          background: #121212;
          border: 1px solid #242424;
          border-radius: 8px;
          padding: 12px;
          margin-top: 12px;
        }

        .serp-top {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #666;
          margin-bottom: 6px;
        }

        .serp-url {
          font-size: 11px;
          color: #60a5fa;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .serp-title {
          font-size: 13.5px;
          color: #93c5fd;
          font-weight: 600;
          line-height: 1.3;
          margin-bottom: 4px;
        }

        .serp-desc {
          font-size: 11.5px;
          color: #9ca3af;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .seo-checklist {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid #262626;
          font-size: 11.5px;
          color: #aaa;
        }

        .checklist-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Pillars Guide */
        .pillars-guide-card {
          border-color: rgba(251, 191, 36, 0.25);
          background: #161411;
        }

        .pillars-mini-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 11.5px;
          color: #aaa;
        }

        .pillars-mini-list strong {
          color: #fbbf24;
        }

        /* Sticky Footer */
        .sticky-editor-footer {
          position: sticky;
          bottom: 0;
          background: #161616;
          border-top: 1px solid #262626;
          padding: 16px 32px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          margin: 32px -32px -80px;
          z-index: 100;
        }

        /* ── Standard Buttons ─────────────────────────────────── */
        .btn-primary {
          background: #DC143C;
          color: #fff;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
        }

        .btn-primary:hover:not(:disabled) {
          background: #b90f32;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #242424;
          border: 1px solid #333;
          color: #eee;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
        }

        .btn-secondary:hover {
          background: #2e2e2e;
          border-color: #555;
        }

        .btn-ghost {
          background: transparent;
          border: 1px solid #333;
          color: #888;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-ghost:hover {
          color: #fff;
          border-color: #555;
        }

        .btn-danger {
          background: #f87171;
          color: #000;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-danger:hover {
          background: #ef4444;
        }

        /* ── Delete Modal ─────────────────────────────────────── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-box {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 14px;
          padding: 28px;
          max-width: 420px;
          width: 100%;
        }

        .modal-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 10px 0;
          color: #fff;
        }

        .modal-text {
          font-size: 13px;
          color: #888;
          line-height: 1.5;
          margin: 0 0 24px 0;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
      `}</style>
    </div>
  )
}
