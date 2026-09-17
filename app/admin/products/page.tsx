'use client'
// app/admin/products/page.tsx
// ─────────────────────────────────────────────────────────────
// Distrito Pipa — Gestor de Productos & Catálogo Oficial
// Alineado al Brand Board: Rojo Eléctrico #DC143C, Negro Carbón, Bebas Neue
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useMemo } from 'react'
import { useProducts, useImageUpload } from '@/hooks/useAdmin'
import { getImageUrl, type Product } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ─── Constants & Brand Guidelines ─────────────────────────────

const CATEGORIES: { value: Product['category']; label: string; icon: string }[] = [
  { value: 'pipes',       label: 'Pipas y Burbujas', icon: '🫧' },
  { value: 'bongs',       label: 'Bongs',            icon: '⚗️' },
  { value: 'rolling',     label: 'Para Forjar',      icon: '🌿' },
  { value: 'accessories', label: 'Accesorios',       icon: '✨' },
  { value: 'torches',     label: 'Sopletes y Gas',   icon: '🔥' },
  { value: 'parts',       label: 'Repuestos',        icon: '⚙️' },
]

const COLORS = [
  'Rojo', 'Verde', 'Azul', 'Amarillo', 'Negro', 'Blanco',
  'Gris', 'Naranja', 'Púrpura', 'Rosa', 'Transparente', 'Ahumado'
]

const SIZES = ['CH', 'M', 'G', 'XL', 'XXL']

// Benchmarks oficiales del Brand Board (brand_brain.md)
const MAYOREO_BENCHMARKS = [
  { name: 'Mini / XS', cost: 4, retail: 49, mayoreoDocena: 9, targetMargin: '91%' },
  { name: 'Sencilla M/G', cost: 6, retail: 69, mayoreoDocena: 14, targetMargin: '91%' },
  { name: 'Reforzada Gruesa', cost: 9, retail: 99, mayoreoDocena: 20, targetMargin: '91%' },
]

const EMPTY_PRODUCT: Partial<Product> = {
  name_es: '',
  cost_mxn: 0,
  category: 'pipes',
  price_mxn: 0,
  bundle_pricing: [],
  size_cm: null,
  colors: [],
  sizes: [],
  description_es: '',
  meta_description_es: '',
  image_paths: [],
  in_stock: true,
  featured: false,
  sort_order: 999,
  slug: '',
}

type SortOption = 'catalog' | 'price_desc' | 'price_asc' | 'margin_desc' | 'name_asc' | 'recent'
type StatusFilter = 'all' | 'in_stock' | 'out_of_stock' | 'featured'

// ─── Main Component ───────────────────────────────────────────

export default function AdminProductsPage() {
  const {
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleStock,
    toggleFeatured,
    loading,
    error,
  } = useProducts()

  const { uploadImage, deleteImage, uploading } = useImageUpload()

  const [products, setProducts] = useState<Product[]>([])
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<Partial<Product>>(EMPTY_PRODUCT)

  // Filtering & Sorting State
  const [filterCat, setFilterCat] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('catalog')

  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [newBundle, setNewBundle] = useState({ qty: 2, price: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const data = await fetchProducts()
    setProducts(data)
  }

  // ─── Form Navigation ─────────────────────────────────────────

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY_PRODUCT, sort_order: (products.length + 1) * 10 })
    setView('form')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({ ...p })
    setView('form')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelForm() {
    setView('list')
    setEditing(null)
    setForm(EMPTY_PRODUCT)
  }

  function setField<K extends keyof Product>(key: K, value: Product[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleNameChange(val: string) {
    setField('name_es', val)
    if (!editing) {
      const generated = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
      setField('slug', generated)
    }
  }

  // ─── Image Upload ────────────────────────────────────────────

  async function handleImageUpload(files: FileList | null) {
    if (!files?.length) return
    const category = (form.category as string) || 'misc'

    for (const file of Array.from(files)) {
      const result = await uploadImage(file, category)
      if (result && result.path) {
        setForm(f => ({ ...f, image_paths: [...(f.image_paths || []), result.path as string] }))
        toast.success(`Imagen subida: ${file.name}`)
      } else {
        toast.error(`❌ Error subiendo: ${result?.error || 'Desconocido'}`)
      }
    }
  }

  async function removeImage(path: string) {
    await deleteImage(path)
    setForm(f => ({ ...f, image_paths: (f.image_paths || []).filter(p => p !== path) }))
    toast.success('Imagen removida')
  }

  // ─── Bundle Pricing ──────────────────────────────────────────

  function addBundle() {
    if (newBundle.qty < 2 || newBundle.price <= 0) {
      toast.error('Especifica cantidad (mínimo 2) y precio total')
      return
    }
    const bundles = [...(form.bundle_pricing || [])]
    const idx = bundles.findIndex(b => b.qty === newBundle.qty)
    if (idx >= 0) bundles[idx] = newBundle
    else bundles.push(newBundle)
    bundles.sort((a, b) => a.qty - b.qty)
    setField('bundle_pricing', bundles)
    setNewBundle({ qty: newBundle.qty + 1, price: 0 })
    toast.success(`Paquete ${newBundle.qty}x guardado`)
  }

  function removeBundle(qty: number) {
    setField('bundle_pricing', (form.bundle_pricing || []).filter(b => b.qty !== qty))
  }

  // ─── Save & Delete ───────────────────────────────────────────

  async function handleSave() {
    if (!form.name_es || !form.category || !form.price_mxn) {
      toast.error('⚠️ Nombre, categoría y precio son obligatorios')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const updated = await updateProduct(editing.id, form)
        if (updated) {
          setProducts(ps => ps.map(p => (p.id === updated.id ? updated : p)))
          toast.success(`✅ "${form.name_es}" actualizado`)
          setView('list')
        }
      } else {
        const created = await createProduct(form)
        if (created) {
          setProducts(ps => [...ps, created])
          toast.success(`✅ "${form.name_es}" creado con éxito`)
          setView('list')
        }
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = await deleteProduct(id)
    if (ok) {
      setProducts(ps => ps.filter(p => p.id !== id))
      toast.success('🗑️ Producto eliminado permanentemente')
    }
    setConfirmDelete(null)
  }

  // ─── Quick Toggles (1-Click) ──────────────────────────────────

  async function handleToggleStock(p: Product, e: React.MouseEvent) {
    e.stopPropagation()
    const newVal = !p.in_stock
    setProducts(ps => ps.map(x => (x.id === p.id ? { ...x, in_stock: newVal } : x)))
    const ok = await toggleStock(p.id, newVal)
    if (ok) {
      toast.success(newVal ? `✓ "${p.name_es}" en stock` : `✗ "${p.name_es}" marcado agotado`)
    } else {
      setProducts(ps => ps.map(x => (x.id === p.id ? { ...x, in_stock: p.in_stock } : x)))
      toast.error('Error al actualizar disponibilidad')
    }
  }

  async function handleToggleFeatured(p: Product, e: React.MouseEvent) {
    e.stopPropagation()
    const newVal = !p.featured
    setProducts(ps => ps.map(x => (x.id === p.id ? { ...x, featured: newVal } : x)))
    const ok = await toggleFeatured(p.id, newVal)
    if (ok) {
      toast.success(newVal ? `★ "${p.name_es}" destacado en home` : `Quitar de destacados: "${p.name_es}"`)
    } else {
      setProducts(ps => ps.map(x => (x.id === p.id ? { ...x, featured: p.featured } : x)))
      toast.error('Error al actualizar destacado')
    }
  }

  // ─── 1-Click Clipboard Helpers ───────────────────────────────

  function copyBlogTag(p: Product, e: React.MouseEvent) {
    e.stopPropagation()
    const tag = `\`\`\`product\n${p.slug || p.id}\n\`\`\``
    navigator.clipboard.writeText(tag)
    toast.success(`📋 Tarjeta de Blog copiada: ${p.name_es}`)
  }

  function copyWhatsAppPitch(p: Product, e: React.MouseEvent) {
    e.stopPropagation()
    const url = `https://www.distritopipa.com/producto/${p.slug || p.id}`
    let msg = `🔥 *${p.name_es} — Distrito Pipa Cancún*\n`
    msg += `💰 *Precio:* $${p.price_mxn.toLocaleString('es-MX')} MXN\n`
    if (p.bundle_pricing && p.bundle_pricing.length > 0) {
      msg += `💥 *Promociones:* ${p.bundle_pricing.map(b => `${b.qty}x $${b.price}`).join(', ')}\n`
    }
    if (p.size_cm) {
      msg += `📏 *Tamaño:* ${p.size_cm} cm\n`
    }
    msg += `📦 Entrega inmediata en Cancún (Puntos en Reg. 96 o envío a domicilio)\n`
    msg += `👉 Ver detalles y fotos: ${url}`
    navigator.clipboard.writeText(msg)
    toast.success('📱 Ficha para WhatsApp / Marketplace copiada')
  }

  // ─── Financial & Inventory Metrics ───────────────────────────

  const stats = useMemo(() => {
    const total = products.length
    const inStock = products.filter(p => p.in_stock).length
    const outStock = products.filter(p => !p.in_stock).length
    const featured = products.filter(p => p.featured).length

    const productsWithCost = products.filter(p => (p.cost_mxn || 0) > 0 && p.price_mxn > 0)
    const avgMargin =
      productsWithCost.length > 0
        ? Math.round(
            productsWithCost.reduce(
              (sum, p) => sum + ((p.price_mxn - (p.cost_mxn || 0)) / p.price_mxn) * 100,
              0
            ) / productsWithCost.length
          )
        : 0

    return { total, inStock, outStock, featured, avgMargin }
  }, [products])

  // ─── Filtered & Sorted Products ──────────────────────────────

  const filteredAndSorted = useMemo(() => {
    const result = products.filter(p => {
      // Category
      const catMatch = filterCat === 'all' || p.category === filterCat

      // Status
      let statusMatch = true
      if (statusFilter === 'in_stock') statusMatch = p.in_stock
      else if (statusFilter === 'out_of_stock') statusMatch = !p.in_stock
      else if (statusFilter === 'featured') statusMatch = p.featured

      // Search Query
      const q = search.toLowerCase().trim()
      const searchMatch =
        !q ||
        p.name_es.toLowerCase().includes(q) ||
        (p.slug && p.slug.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q) ||
        (p.colors && p.colors.some(c => c.toLowerCase().includes(q))) ||
        (p.description_es && p.description_es.toLowerCase().includes(q))

      return catMatch && statusMatch && searchMatch
    })

    result.sort((a, b) => {
      if (sortBy === 'catalog') return (a.sort_order ?? 999) - (b.sort_order ?? 999)
      if (sortBy === 'price_desc') return b.price_mxn - a.price_mxn
      if (sortBy === 'price_asc') return a.price_mxn - b.price_mxn
      if (sortBy === 'margin_desc') {
        const marginA = a.price_mxn > 0 ? (a.price_mxn - (a.cost_mxn || 0)) / a.price_mxn : 0
        const marginB = b.price_mxn > 0 ? (b.price_mxn - (b.cost_mxn || 0)) / b.price_mxn : 0
        return marginB - marginA
      }
      if (sortBy === 'name_asc') return a.name_es.localeCompare(b.name_es)
      if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return 0
    })

    return result
  }, [products, filterCat, statusFilter, search, sortBy])

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

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="modal-title">¿Eliminar producto?</h3>
            <p className="modal-sub">
              Esta acción eliminará el registro y todas sus imágenes asociadas del bucket de almacenamiento.
            </p>
            <div className="modal-actions">
              <button className="btn-danger" onClick={() => handleDelete(confirmDelete)}>
                Sí, eliminar producto
              </button>
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="page-header">
        <div className="header-titles">
          <div className="page-eyebrow">Catálogo & Inventario Oficial</div>
          <h1 className="page-title">Gestor de Productos</h1>
        </div>

        <div className="header-actions">
          <a
            href="/catalogo"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            title="Ver catálogo público en una nueva pestaña"
          >
            🏪 Ver Catálogo Público ↗
          </a>
          {view === 'list' && (
            <button className="btn-primary" onClick={openNew}>
              + Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <>
          {/* KPI Stats Bar */}
          <div className="stats-grid">
            <div
              className={`stat-card ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <span className="stat-label">Total Productos</span>
              <span className="stat-val">{stats.total}</span>
              <span className="stat-sub">En catálogo</span>
            </div>

            <div
              className={`stat-card green ${statusFilter === 'in_stock' ? 'active' : ''}`}
              onClick={() => setStatusFilter('in_stock')}
            >
              <span className="stat-label">En Stock</span>
              <span className="stat-val text-green">{stats.inStock}</span>
              <span className="stat-sub">Disponibles</span>
            </div>

            <div
              className={`stat-card red ${statusFilter === 'out_of_stock' ? 'active' : ''}`}
              onClick={() => setStatusFilter('out_of_stock')}
            >
              <span className="stat-label">Agotados</span>
              <span className="stat-val text-red">{stats.outStock}</span>
              <span className="stat-sub">Requieren resurtido</span>
            </div>

            <div
              className={`stat-card gold ${statusFilter === 'featured' ? 'active' : ''}`}
              onClick={() => setStatusFilter('featured')}
            >
              <span className="stat-label">Destacados</span>
              <span className="stat-val text-gold">{stats.featured}</span>
              <span className="stat-sub">Portada de Home</span>
            </div>

            <div className="stat-card margin">
              <span className="stat-label">Margen Promedio</span>
              <span className="stat-val text-red-brand">{stats.avgMargin}%</span>
              <span className="stat-sub">Rentabilidad catálogo</span>
            </div>
          </div>

          {/* Control Bar: Search, Category Tabs, Sorting */}
          <div className="control-bar">
            <div className="search-sort-row">
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  className="search-input"
                  placeholder="Buscar por nombre, slug, atributo o descripción..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button className="clear-search-btn" onClick={() => setSearch('')}>
                    ✕
                  </button>
                )}
              </div>

              {/* Status Pills */}
              <div className="status-pills">
                <button
                  className={`pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  Todos ({products.length})
                </button>
                <button
                  className={`pill-btn green ${statusFilter === 'in_stock' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('in_stock')}
                >
                  🟢 Stock ({stats.inStock})
                </button>
                <button
                  className={`pill-btn red ${statusFilter === 'out_of_stock' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('out_of_stock')}
                >
                  🔴 Agotados ({stats.outStock})
                </button>
                <button
                  className={`pill-btn gold ${statusFilter === 'featured' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('featured')}
                >
                  ⭐ Destacados ({stats.featured})
                </button>
              </div>

              {/* Sorting Selector */}
              <div className="sort-box">
                <label className="sort-label">Ordenar:</label>
                <select
                  className="sort-select"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                >
                  <option value="catalog">📌 Orden de Catálogo</option>
                  <option value="price_desc">💰 Mayor Precio</option>
                  <option value="price_asc">🏷️ Menor Precio</option>
                  <option value="margin_desc">📈 Mayor Margen (%)</option>
                  <option value="name_asc">🔤 Nombre (A - Z)</option>
                  <option value="recent">🕒 Más Recientes</option>
                </select>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="category-tabs">
              <button
                className={`cat-tab ${filterCat === 'all' ? 'active' : ''}`}
                onClick={() => setFilterCat('all')}
              >
                Todas las Categorías ({products.length})
              </button>
              {CATEGORIES.map(c => {
                const count = products.filter(p => p.category === c.value).length
                return (
                  <button
                    key={c.value}
                    className={`cat-tab ${filterCat === c.value ? 'active' : ''}`}
                    onClick={() => setFilterCat(c.value)}
                  >
                    <span>{c.icon}</span> {c.label} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {/* Products List */}
          <div className="product-list-container">
            {loading && <div className="state-notice">Cargando inventario de Distrito Pipa...</div>}

            {!loading && filteredAndSorted.length === 0 && (
              <div className="empty-catalog">
                <p>No se encontraron productos con los filtros aplicados.</p>
                <button
                  onClick={() => {
                    setSearch('')
                    setFilterCat('all')
                    setStatusFilter('all')
                  }}
                  className="btn-ghost-sm"
                >
                  Limpiar filtros
                </button>
              </div>
            )}

            {!loading && (
              <div className="product-grid">
                {filteredAndSorted.map(p => {
                  const cost = p.cost_mxn || 0
                  const price = p.price_mxn || 0
                  const profit = price - cost
                  const marginPct = price > 0 ? Math.round((profit / price) * 100) : 0
                  const thumb = p.image_paths?.[0] ? getImageUrl(p.image_paths[0]) : null

                  return (
                    <div
                      key={p.id}
                      className={`product-card-item ${!p.in_stock ? 'out-of-stock' : ''} ${
                        p.featured ? 'is-featured' : ''
                      }`}
                    >
                      {/* Top Bar of Card: Featured Star & Status */}
                      <div className="card-top-row">
                        <button
                          className={`star-toggle ${p.featured ? 'active' : ''}`}
                          onClick={e => handleToggleFeatured(p, e)}
                          title={p.featured ? 'Destacado en Home (Clic para quitar)' : 'Clic para destacar en Home'}
                        >
                          {p.featured ? '★ DESTACADO' : '☆ Destacar'}
                        </button>

                        <button
                          className={`stock-pill-btn ${p.in_stock ? 'in-stock' : 'out-stock'}`}
                          onClick={e => handleToggleStock(p, e)}
                          title={p.in_stock ? 'En Stock (Clic para marcar agotado)' : 'Agotado (Clic para habilitar stock)'}
                        >
                          {p.in_stock ? '✓ EN STOCK' : '✗ AGOTADO'}
                        </button>
                      </div>

                      {/* Main Product Info Block */}
                      <div className="card-body-flex">
                        {/* Thumbnail */}
                        <div className="card-thumb-wrapper">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb} alt={p.name_es} className="card-thumb-img" />
                          ) : (
                            <div className="card-no-thumb">Sin foto</div>
                          )}
                          <span className="thumb-order-badge">#{p.sort_order ?? 99}</span>
                        </div>

                        {/* Details */}
                        <div className="card-details">
                          <div className="card-category-tag">
                            {CATEGORIES.find(c => c.value === p.category)?.icon}{' '}
                            {CATEGORIES.find(c => c.value === p.category)?.label || p.category}
                          </div>

                          <h3 className="card-product-name">{p.name_es}</h3>

                          {/* Attributes */}
                          <div className="card-attributes-row">
                            {p.size_cm && <span className="attr-chip">📏 {p.size_cm} cm</span>}
                            {p.colors && p.colors.length > 0 && (
                              <span className="attr-chip">🎨 {p.colors.slice(0, 3).join(', ')}{p.colors.length > 3 ? '...' : ''}</span>
                            )}
                            {p.slug && <span className="attr-chip slug-chip">🔗 /{p.slug}</span>}
                          </div>

                          {/* Bundles */}
                          {p.bundle_pricing && p.bundle_pricing.length > 0 && (
                            <div className="card-bundles-row">
                              {p.bundle_pricing.map(b => (
                                <span key={b.qty} className="bundle-badge">
                                  {b.qty}x ${b.price}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Financial Ledger Section */}
                        <div className="card-financials">
                          <div className="price-tag-big">${price.toLocaleString('es-MX')}</div>
                          <div className="price-currency">MXN Retail</div>

                          <div className="financial-breakdown">
                            <div className="fin-row">
                              <span className="fin-label">Costo:</span>
                              <span className="fin-val">${cost.toLocaleString('es-MX')}</span>
                            </div>
                            <div className="fin-row">
                              <span className="fin-label">Margen:</span>
                              <span className={`fin-val ${marginPct >= 70 ? 'high-margin' : ''}`}>
                                {marginPct}% (${profit.toLocaleString('es-MX')})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Strip (1-Click Tools) */}
                      <div className="card-actions-strip">
                        <a
                          href={`/producto/${p.slug || p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-action-tool"
                          title="Abrir ficha pública en tienda"
                        >
                          👁️ Tienda ↗
                        </a>

                        <button
                          className="btn-action-tool"
                          onClick={e => copyBlogTag(p, e)}
                          title="Copiar tarjeta en markdown para usar en artículos de Blog"
                        >
                          📰 Tarjeta Blog
                        </button>

                        <button
                          className="btn-action-tool"
                          onClick={e => copyWhatsAppPitch(p, e)}
                          title="Copiar texto con precio y link listo para enviar por WhatsApp o Facebook Marketplace"
                        >
                          📱 WhatsApp
                        </button>

                        <div className="ml-auto-actions">
                          <button className="btn-action-edit" onClick={() => openEdit(p)}>
                            ✏️ Editar
                          </button>
                          <button
                            className="btn-action-del"
                            onClick={() => setConfirmDelete(p.id)}
                            title="Eliminar producto"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── FORM VIEW (CREATE / EDIT) ── */}
      {view === 'form' && (
        <div className="form-container">
          <div className="form-top-nav">
            <button className="btn-ghost" onClick={cancelForm}>
              ← Volver al Listado
            </button>

            <div className="form-title-group">
              <h2 className="form-main-title">
                {editing ? `Editar: ${editing.name_es}` : 'Nuevo Producto en Catálogo'}
              </h2>
              {/* Real-time Profit & Margin Indicator */}
              {Boolean((form.price_mxn || 0) > 0) && (
                <div className="live-profit-indicator">
                  <span className="lpi-label">Rendimiento:</span>
                  <span className="lpi-profit">
                    +${((form.price_mxn || 0) - (form.cost_mxn || 0)).toLocaleString('es-MX')} MXN
                  </span>
                  <span className="lpi-margin">
                    (
                    {Math.round(
                      (((form.price_mxn || 0) - (form.cost_mxn || 0)) / (form.price_mxn || 1)) * 100
                    )}
                    % margen bruto)
                  </span>
                </div>
              )}
            </div>

            <div className="form-quick-save">
              <button className="btn-primary" onClick={handleSave} disabled={saving || uploading}>
                {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Crear Producto'}
              </button>
            </div>
          </div>

          <div className="form-columns-grid">
            {/* ── COLUMNA IZQUIERDA ── */}
            <div className="form-column">
              {/* Información Básica */}
              <div className="form-card">
                <h3 className="card-section-title">1. Información Comercial</h3>

                <label className="field-label">Nombre del Producto *</label>
                <input
                  className="field-input text-bold"
                  value={form.name_es || ''}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="Ej: Burbuja Reforzada Gruesa"
                />

                <div className="field-split">
                  <div>
                    <label className="field-label">Categoría Oficial *</label>
                    <select
                      className="field-select"
                      value={form.category || 'pipes'}
                      onChange={e => setField('category', e.target.value as Product['category'])}
                    >
                      {CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>
                          {c.icon} {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label">Orden de Visualización</label>
                    <input
                      className="field-input"
                      type="number"
                      min="1"
                      value={form.sort_order ?? 999}
                      onChange={e => setField('sort_order', parseInt(e.target.value) || 999)}
                      placeholder="1"
                    />
                  </div>
                </div>

                {/* Precios y Costos */}
                <div className="field-split three-cols">
                  <div>
                    <label className="field-label">Costo Proveedor (MXN)</label>
                    <input
                      className="field-input"
                      type="number"
                      min="0"
                      value={form.cost_mxn || ''}
                      onChange={e => setField('cost_mxn', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                    <span className="field-subtext">Base de compra</span>
                  </div>

                  <div>
                    <label className="field-label">Precio Público (MXN) *</label>
                    <input
                      className="field-input price-highlight"
                      type="number"
                      min="0"
                      value={form.price_mxn || ''}
                      onChange={e => setField('price_mxn', parseFloat(e.target.value) || 0)}
                      placeholder="99"
                    />
                    <span className="field-subtext">Precio retail venta</span>
                  </div>

                  <div>
                    <label className="field-label">Tamaño (cm)</label>
                    <input
                      className="field-input"
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.size_cm || ''}
                      onChange={e => setField('size_cm', parseFloat(e.target.value) || null)}
                      placeholder="10"
                    />
                    <span className="field-subtext">Opcional</span>
                  </div>
                </div>

                {/* Slug y URL del producto */}
                <div className="slug-generator-box">
                  <label className="field-label">Slug de URL (Identificador Único)</label>
                  <div className="slug-input-wrapper">
                    <span className="slug-prefix">distritopipa.com/producto/</span>
                    <input
                      className="slug-input"
                      value={form.slug || ''}
                      onChange={e => setField('slug', e.target.value)}
                      placeholder="pipa-reforzada-cancun"
                    />
                  </div>
                  <p className="field-hint">
                    Usado para el enlace de venta y para insertar en el blog (````product [slug]````).
                  </p>
                </div>
              </div>

              {/* Paquetes y Descuentos por Volumen (Bundles) */}
              <div className="form-card">
                <div className="card-section-header">
                  <h3 className="card-section-title">2. Promociones por Volumen (Bundles)</h3>
                  <span className="section-badge">Incrementa el ticket promedio</span>
                </div>

                {(form.bundle_pricing || []).length === 0 ? (
                  <p className="empty-subnote">No hay promociones por volumen configuradas para este producto.</p>
                ) : (
                  <div className="bundles-list">
                    {(form.bundle_pricing || []).map(b => {
                      const regularPrice = (form.price_mxn || 0) * b.qty
                      const savings = regularPrice > b.price ? regularPrice - b.price : 0
                      return (
                        <div key={b.qty} className="bundle-edit-row">
                          <div className="ber-qty">{b.qty} unidades</div>
                          <div className="ber-price">${b.price} MXN</div>
                          {savings > 0 && <div className="ber-savings">Ahorro cliente: ${savings} MXN</div>}
                          <button className="remove-bundle-btn" onClick={() => removeBundle(b.qty)}>
                            ✕
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="add-bundle-box">
                  <div className="add-bundle-inputs">
                    <div>
                      <span className="bundle-input-label">Cantidad:</span>
                      <input
                        className="field-input text-center"
                        type="number"
                        min="2"
                        value={newBundle.qty}
                        onChange={e => setNewBundle(b => ({ ...b, qty: parseInt(e.target.value) || 2 }))}
                        style={{ width: '80px' }}
                      />
                    </div>
                    <span className="times-symbol">×</span>
                    <div>
                      <span className="bundle-input-label">Precio Combo Total ($ MXN):</span>
                      <input
                        className="field-input"
                        type="number"
                        min="0"
                        value={newBundle.price || ''}
                        onChange={e => setNewBundle(b => ({ ...b, price: parseFloat(e.target.value) || 0 }))}
                        placeholder="Ej. 179"
                        style={{ width: '130px' }}
                      />
                    </div>
                    <button className="btn-secondary" onClick={addBundle}>
                      + Añadir Combo
                    </button>
                  </div>
                </div>
              </div>

              {/* Variantes de Color y Tallas */}
              <div className="form-card">
                <h3 className="card-section-title">3. Variantes: Colores y Medidas</h3>

                <label className="field-label">Colores Disponibles</label>
                <div className="color-selector-grid">
                  {COLORS.map(c => {
                    const active = (form.colors || []).includes(c)
                    return (
                      <label key={c} className={`color-pill-label ${active ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={e => {
                            const current = form.colors || []
                            if (e.target.checked) setField('colors', [...current, c])
                            else setField('colors', current.filter(x => x !== c))
                          }}
                        />
                        <span>{c}</span>
                      </label>
                    )
                  })}
                </div>

                <label className="field-label" style={{ marginTop: '16px' }}>
                  Tallas Disponibles (Mismo Precio)
                </label>
                <div className="size-selector-grid">
                  {SIZES.map(s => {
                    const active = (form.sizes || []).includes(s)
                    return (
                      <label key={s} className={`size-pill-label ${active ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={e => {
                            const current = form.sizes || []
                            if (e.target.checked) setField('sizes', [...current, s])
                            else setField('sizes', current.filter(x => x !== s))
                          }}
                        />
                        <span>{s}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ── COLUMNA DERECHA ── */}
            <div className="form-column">
              {/* Fotos del Producto */}
              <div className="form-card">
                <div className="card-section-header">
                  <h3 className="card-section-title">4. Fotografías del Producto</h3>
                  <span className="section-badge">Supabase Storage</span>
                </div>
                <p className="field-hint">
                  PNG o WEBP sin fondo o fondo neutro recomendado. La primera imagen se usará como portada.
                </p>

                {/* Upload drop zone */}
                <div
                  className="upload-drop-zone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => {
                    e.preventDefault()
                    e.currentTarget.classList.add('drag-active')
                  }}
                  onDragLeave={e => e.currentTarget.classList.remove('drag-active')}
                  onDrop={e => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('drag-active')
                    handleImageUpload(e.dataTransfer.files)
                  }}
                >
                  {uploading ? (
                    <div className="uploading-state">Subiendo fotografía a Supabase...</div>
                  ) : (
                    <>
                      <span className="upload-icon-big">📸</span>
                      <span className="upload-cta">Haz clic o arrastra fotos aquí</span>
                      <span className="upload-format-note">PNG, JPG, WEBP (Máx 5MB)</span>
                    </>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => handleImageUpload(e.target.files)}
                />

                {/* Previews */}
                {(form.image_paths || []).length > 0 && (
                  <div className="images-preview-grid">
                    {(form.image_paths || []).map((path, idx) => (
                      <div key={path} className="preview-card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getImageUrl(path)} alt="preview" className="preview-img" />
                        {idx === 0 && <span className="primary-badge">★ Portada</span>}
                        <button
                          className="btn-del-img"
                          onClick={() => removeImage(path)}
                          title="Eliminar fotografía"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Descripciones & SEO */}
              <div className="form-card">
                <h3 className="card-section-title">5. Descripciones & SEO Local</h3>

                <label className="field-label">Descripción para la Tienda</label>
                <textarea
                  className="field-textarea"
                  rows={4}
                  value={form.description_es || ''}
                  onChange={e => setField('description_es', e.target.value)}
                  placeholder="Material, especificaciones, grosor del vidrio, recomendaciones de uso..."
                />

                <label className="field-label" style={{ marginTop: '16px' }}>
                  Meta Descripción SEO (Google & Redes Sociales)
                </label>
                <textarea
                  className="field-textarea"
                  rows={2}
                  value={form.meta_description_es || ''}
                  onChange={e => setField('meta_description_es', e.target.value)}
                  placeholder="Descripción concisa optimizada para búsquedas en Cancún (Ideal 140 - 160 caracteres)."
                />
                <span className="field-subtext">
                  Longitud recomendada: {(form.meta_description_es || '').length}/155 caracteres
                </span>
              </div>

              {/* Opciones de Catálogo & Visibilidad */}
              <div className="form-card">
                <h3 className="card-section-title">6. Opciones de Publicación</h3>

                <label className="switch-row">
                  <div>
                    <strong>En Stock (Disponible para Compra)</strong>
                    <div className="switch-desc">Si se desmarca, aparecerá como &ldquo;Agotado&rdquo; en la tienda.</div>
                  </div>
                  <input
                    type="checkbox"
                    className="custom-checkbox"
                    checked={form.in_stock ?? true}
                    onChange={e => setField('in_stock', e.target.checked)}
                  />
                </label>

                <label className="switch-row">
                  <div>
                    <strong>Destacado en Home (Página Principal ★)</strong>
                    <div className="switch-desc">Muestra este producto en el carrusel y vitrina estelar de inicio.</div>
                  </div>
                  <input
                    type="checkbox"
                    className="custom-checkbox"
                    checked={form.featured ?? false}
                    onChange={e => setField('featured', e.target.checked)}
                  />
                </label>
              </div>

              {/* Referencia Brand Board (Guía de Precios de Mayoreo) */}
              <div className="form-card brand-board-card">
                <div className="card-section-header">
                  <h3 className="card-section-title text-gold">🧠 Guía de Mayoreo (Brand Board)</h3>
                  <span className="section-badge gold">Estrategia Oficial</span>
                </div>
                <p className="field-hint text-light-muted">
                  Precios sugeridos en `brand_brain.md` para venta por docena a revendedores locales en Cancún:
                </p>
                <div className="mayoreo-table">
                  <div className="mt-header">
                    <span>Línea</span>
                    <span>Costo</span>
                    <span>Venta Menudeo</span>
                    <span>Mayoreo Docena</span>
                  </div>
                  {MAYOREO_BENCHMARKS.map((m, i) => (
                    <div key={i} className="mt-row">
                      <strong>{m.name}</strong>
                      <span>${m.cost}</span>
                      <span>${m.retail}</span>
                      <strong className="text-gold">${m.mayoreoDocena}/pz</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Save Footer */}
          <div className="sticky-save-footer">
            {error && <div className="save-error-banner">⚠️ {error}</div>}
            <button className="btn-ghost" onClick={cancelForm} disabled={saving}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || uploading}>
              {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Crear Producto'}
            </button>
          </div>
        </div>
      )}

      {/* ── STYLES (BRAND BOARD ALIGNED) ── */}
      <style jsx>{`
        /* ── Base & Layout ──────────────────────────────────── */
        .admin-page {
          min-height: 100vh;
          background: #111111;
          color: #f3f4f6;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          padding-bottom: 80px;
        }

        /* ── Page Header ────────────────────────────────────── */
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

        /* ── KPI Stats Grid ─────────────────────────────────── */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 14px;
          padding: 24px 32px 16px;
        }

        .stat-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .stat-card:hover {
          border-color: #444;
          transform: translateY(-1px);
        }

        .stat-card.active {
          border-color: #DC143C;
          background: #201a1c;
        }

        .stat-card.green.active {
          border-color: #4ade80;
          background: rgba(74, 222, 128, 0.08);
        }

        .stat-card.red.active {
          border-color: #f87171;
          background: rgba(248, 113, 113, 0.08);
        }

        .stat-card.gold.active {
          border-color: #fbbf24;
          background: rgba(251, 191, 36, 0.08);
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
          font-size: 30px;
          line-height: 1;
          color: #ffffff;
        }

        .stat-sub {
          font-size: 11px;
          color: #666;
        }

        .text-green { color: #4ade80 !important; }
        .text-red { color: #f87171 !important; }
        .text-gold { color: #fbbf24 !important; }
        .text-red-brand { color: #DC143C !important; }

        /* ── Control Bar ────────────────────────────────────── */
        .control-bar {
          padding: 8px 32px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
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
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          color: #fff;
          padding: 10px 14px 10px 36px;
          font-size: 13px;
          font-family: inherit;
          transition: border-color 0.15s;
        }

        .search-input:focus {
          outline: none;
          border-color: #DC143C;
        }

        .clear-search-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          font-size: 12px;
        }

        .status-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .pill-btn {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          color: #999;
          font-size: 12px;
          padding: 6px 12px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .pill-btn:hover {
          color: #fff;
          border-color: #555;
        }

        .pill-btn.active {
          background: #2a2a2a;
          color: #fff;
          border-color: #666;
        }

        .pill-btn.green.active {
          background: rgba(74, 222, 128, 0.15);
          color: #4ade80;
          border-color: #4ade80;
        }

        .pill-btn.red.active {
          background: rgba(248, 113, 113, 0.15);
          color: #f87171;
          border-color: #f87171;
        }

        .pill-btn.gold.active {
          background: rgba(251, 191, 36, 0.15);
          color: #fbbf24;
          border-color: #fbbf24;
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
          border: 1px solid #2a2a2a;
          color: #fff;
          font-size: 12px;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
        }

        .sort-select:focus {
          outline: none;
          border-color: #DC143C;
        }

        .category-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .cat-tab {
          background: transparent;
          border: 1px solid #262626;
          color: #888;
          font-size: 12px;
          padding: 7px 14px;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
        }

        .cat-tab:hover {
          color: #fff;
          border-color: #444;
          background: #1a1a1a;
        }

        .cat-tab.active {
          background: #DC143C;
          border-color: #DC143C;
          color: #ffffff;
          font-weight: 600;
        }

        /* ── Products List & Cards ──────────────────────────── */
        .product-list-container {
          padding: 0 32px;
        }

        .state-notice, .empty-catalog {
          padding: 60px 0;
          text-align: center;
          color: #888;
          font-size: 14px;
        }

        .product-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .product-card-item {
          background: #1a1a1a;
          border: 1px solid #262626;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.15s ease;
        }

        .product-card-item:hover {
          border-color: #383838;
          background: #1d1d1d;
        }

        .product-card-item.is-featured {
          border-left: 4px solid #fbbf24;
        }

        .product-card-item.out-of-stock {
          opacity: 0.65;
        }

        /* Top Row inside Card */
        .card-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 8px;
          border-bottom: 1px solid #242424;
        }

        .star-toggle {
          background: none;
          border: 1px solid #333;
          color: #777;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .star-toggle:hover {
          color: #fbbf24;
          border-color: #fbbf24;
        }

        .star-toggle.active {
          color: #fbbf24;
          border-color: rgba(251, 191, 36, 0.4);
          background: rgba(251, 191, 36, 0.12);
        }

        .stock-pill-btn {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 20px;
          border: 1px solid;
          cursor: pointer;
          transition: all 0.15s;
        }

        .stock-pill-btn.in-stock {
          background: rgba(74, 222, 128, 0.12);
          color: #4ade80;
          border-color: rgba(74, 222, 128, 0.35);
        }

        .stock-pill-btn.in-stock:hover {
          background: rgba(74, 222, 128, 0.22);
          border-color: #4ade80;
        }

        .stock-pill-btn.out-stock {
          background: rgba(248, 113, 113, 0.12);
          color: #f87171;
          border-color: rgba(248, 113, 113, 0.35);
        }

        .stock-pill-btn.out-stock:hover {
          background: rgba(248, 113, 113, 0.22);
          border-color: #f87171;
        }

        /* Body Flex inside Card */
        .card-body-flex {
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
        }

        .card-thumb-wrapper {
          position: relative;
          width: 68px;
          height: 68px;
          border-radius: 8px;
          background: #111;
          border: 1px solid #2a2a2a;
          overflow: hidden;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-thumb-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .card-no-thumb {
          font-size: 10px;
          color: #555;
          text-align: center;
        }

        .thumb-order-badge {
          position: absolute;
          bottom: 2px;
          right: 2px;
          background: rgba(0, 0, 0, 0.85);
          color: #888;
          font-size: 9px;
          padding: 1px 4px;
          border-radius: 3px;
        }

        .card-details {
          flex: 1;
          min-width: 220px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .card-category-tag {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 600;
        }

        .card-product-name {
          font-size: 16px;
          font-weight: 600;
          color: #ffffff;
          margin: 0;
        }

        .card-attributes-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 2px;
        }

        .attr-chip {
          font-size: 11px;
          background: #242424;
          color: #aaa;
          padding: 2px 7px;
          border-radius: 4px;
        }

        .slug-chip {
          color: #60a5fa;
          background: rgba(96, 165, 250, 0.1);
        }

        .card-bundles-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .bundle-badge {
          font-size: 10.5px;
          background: rgba(220, 20, 60, 0.12);
          border: 1px solid rgba(220, 20, 60, 0.3);
          color: #ff6b81;
          padding: 2px 6px;
          border-radius: 4px;
        }

        /* Financial Ledger */
        .card-financials {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          min-width: 140px;
          padding-left: 12px;
          border-left: 1px solid #242424;
        }

        .price-tag-big {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 26px;
          line-height: 1;
          color: #ffffff;
        }

        .price-currency {
          font-size: 10px;
          color: #888;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .financial-breakdown {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 11px;
        }

        .fin-row {
          display: flex;
          gap: 6px;
          justify-content: flex-end;
        }

        .fin-label {
          color: #777;
        }

        .fin-val {
          color: #ddd;
          font-weight: 500;
        }

        .fin-val.high-margin {
          color: #4ade80;
          font-weight: 600;
        }

        /* Action Strip */
        .card-actions-strip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-top: 10px;
          border-top: 1px solid #242424;
          flex-wrap: wrap;
        }

        .btn-action-tool {
          background: #242424;
          border: 1px solid #333;
          color: #bbb;
          font-size: 11.5px;
          font-weight: 500;
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s;
        }

        .btn-action-tool:hover {
          background: #303030;
          color: #fff;
          border-color: #555;
        }

        .ml-auto-actions {
          margin-left: auto;
          display: flex;
          gap: 6px;
        }

        .btn-action-edit {
          background: #DC143C;
          border: 1px solid #DC143C;
          color: #fff;
          font-size: 11.5px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-action-edit:hover {
          background: #b90f32;
        }

        .btn-action-del {
          background: #242424;
          border: 1px solid #333;
          color: #888;
          font-size: 12px;
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-action-del:hover {
          color: #f87171;
          border-color: #f87171;
          background: rgba(248, 113, 113, 0.1);
        }

        /* ── Form View (Create / Edit) ──────────────────────── */
        .form-container {
          padding: 0 32px;
        }

        .form-top-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 0;
          border-bottom: 1px solid #262626;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .form-title-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .form-main-title {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 28px;
          margin: 0;
          letter-spacing: 0.04em;
          color: #fff;
        }

        .live-profit-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          background: rgba(74, 222, 128, 0.1);
          border: 1px solid rgba(74, 222, 128, 0.3);
          padding: 3px 8px;
          border-radius: 6px;
          width: fit-content;
        }

        .lpi-label { color: #888; }
        .lpi-profit { color: #4ade80; font-weight: 700; }
        .lpi-margin { color: #86efac; }

        .form-columns-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }

        @media (min-width: 960px) {
          .form-columns-grid {
            grid-template-columns: 1.1fr 0.9fr;
          }
        }

        .form-column {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .form-card {
          background: #1a1a1a;
          border: 1px solid #262626;
          border-radius: 12px;
          padding: 22px;
        }

        .card-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .card-section-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #DC143C;
          margin: 0 0 14px 0;
        }

        .card-section-header .card-section-title {
          margin: 0;
        }

        .section-badge {
          font-size: 10px;
          color: #888;
          background: #242424;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .section-badge.gold {
          color: #fbbf24;
          background: rgba(251, 191, 36, 0.1);
        }

        .field-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #bbb;
          margin-bottom: 6px;
          margin-top: 14px;
        }

        .field-label:first-of-type {
          margin-top: 0;
        }

        .field-input, .field-select, .field-textarea {
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

        .field-input:focus, .field-select:focus, .field-textarea:focus {
          outline: none;
          border-color: #DC143C;
        }

        .field-input.text-bold {
          font-weight: 600;
          font-size: 14px;
        }

        .field-input.price-highlight {
          border-color: rgba(220, 20, 60, 0.4);
          font-weight: 700;
          color: #ff6b81;
        }

        .field-subtext {
          font-size: 10.5px;
          color: #666;
          margin-top: 4px;
          display: block;
        }

        .field-hint {
          font-size: 11px;
          color: #666;
          margin-top: 6px;
          line-height: 1.4;
        }

        .field-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
        }

        .field-split.three-cols {
          grid-template-columns: 1fr 1fr 1fr;
        }

        /* Slug Generator Box */
        .slug-generator-box {
          margin-top: 16px;
          background: #141414;
          padding: 14px;
          border-radius: 8px;
          border: 1px solid #262626;
        }

        .slug-input-wrapper {
          display: flex;
          align-items: center;
          background: #111;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          overflow: hidden;
        }

        .slug-prefix {
          padding: 8px 10px;
          font-size: 12px;
          color: #666;
          background: #161616;
          border-right: 1px solid #262626;
          white-space: nowrap;
        }

        .slug-input {
          flex: 1;
          background: transparent;
          border: none;
          color: #60a5fa;
          padding: 8px 10px;
          font-size: 12px;
          font-family: inherit;
        }

        .slug-input:focus {
          outline: none;
        }

        /* Bundles in Form */
        .empty-subnote {
          font-size: 12px;
          color: #666;
          margin: 6px 0 14px;
        }

        .bundles-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 14px;
        }

        .bundle-edit-row {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #111;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
        }

        .ber-qty {
          font-weight: 600;
          color: #eee;
        }

        .ber-price {
          color: #DC143C;
          font-weight: 700;
        }

        .ber-savings {
          font-size: 11px;
          color: #4ade80;
          margin-left: auto;
        }

        .remove-bundle-btn {
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          font-size: 14px;
        }

        .remove-bundle-btn:hover {
          color: #f87171;
        }

        .add-bundle-box {
          background: #141414;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #242424;
        }

        .add-bundle-inputs {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .bundle-input-label {
          display: block;
          font-size: 10px;
          color: #777;
          margin-bottom: 2px;
        }

        .times-symbol {
          color: #666;
          font-size: 16px;
          margin-top: 12px;
        }

        /* Color & Size Selector Grid */
        .color-selector-grid, .size-selector-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 6px;
          margin-top: 6px;
        }

        .color-pill-label, .size-pill-label {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #111;
          border: 1px solid #262626;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          color: #888;
          cursor: pointer;
          transition: all 0.15s;
        }

        .color-pill-label.active, .size-pill-label.active {
          border-color: #DC143C;
          color: #fff;
          background: rgba(220, 20, 60, 0.1);
        }

        .color-pill-label input, .size-pill-label input {
          accent-color: #DC143C;
        }

        /* Image Upload Drop Zone */
        .upload-drop-zone {
          border: 2px dashed #333;
          border-radius: 10px;
          padding: 36px 20px;
          text-align: center;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          background: #141414;
          transition: all 0.2s;
        }

        .upload-drop-zone:hover, .upload-drop-zone.drag-active {
          border-color: #DC143C;
          background: rgba(220, 20, 60, 0.05);
        }

        .upload-icon-big {
          font-size: 32px;
        }

        .upload-cta {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
        }

        .upload-format-note {
          font-size: 11px;
          color: #666;
        }

        .uploading-state {
          color: #DC143C;
          font-size: 13px;
          font-weight: 600;
        }

        .images-preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .preview-card {
          position: relative;
          aspect-ratio: 1;
          border-radius: 8px;
          overflow: hidden;
          background: #111;
          border: 1px solid #2a2a2a;
        }

        .preview-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .primary-badge {
          position: absolute;
          bottom: 4px;
          left: 4px;
          background: rgba(0, 0, 0, 0.85);
          color: #fbbf24;
          font-size: 9px;
          font-weight: 700;
          padding: 2px 4px;
          border-radius: 3px;
        }

        .btn-del-img {
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(0, 0, 0, 0.85);
          color: #fff;
          border: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
        }

        .btn-del-img:hover {
          background: #DC143C;
        }

        /* Publication Switches */
        .switch-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #242424;
          cursor: pointer;
        }

        .switch-row:last-child {
          border-bottom: none;
        }

        .switch-desc {
          font-size: 11px;
          color: #777;
          margin-top: 2px;
        }

        .custom-checkbox {
          width: 18px;
          height: 18px;
          accent-color: #DC143C;
          cursor: pointer;
        }

        /* Brand Board Card */
        .brand-board-card {
          border-color: rgba(251, 191, 36, 0.3);
          background: #171511;
        }

        .text-light-muted {
          color: #9ca3af;
        }

        .mayoreo-table {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 10px;
          font-size: 12px;
        }

        .mt-header {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr 1fr 1fr;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: #888;
          padding: 4px 6px;
          border-bottom: 1px solid #2a2a2a;
        }

        .mt-row {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr 1fr 1fr;
          padding: 6px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 4px;
          align-items: center;
        }

        /* Sticky Save Footer */
        .sticky-save-footer {
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

        .save-error-banner {
          margin-right: auto;
          color: #f87171;
          font-size: 13px;
        }

        /* ── Standard Buttons ───────────────────────────────── */
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

        .btn-ghost-sm {
          background: #242424;
          border: 1px solid #333;
          color: #aaa;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          margin-top: 10px;
        }

        .btn-ghost-sm:hover {
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

        /* ── Delete Modal ───────────────────────────────────── */
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

        .modal {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 14px;
          padding: 28px;
          max-width: 400px;
          width: 100%;
        }

        .modal-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 10px 0;
          color: #fff;
        }

        .modal-sub {
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
