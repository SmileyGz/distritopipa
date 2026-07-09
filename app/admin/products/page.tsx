'use client'
// app/admin/products/page.tsx
// ─────────────────────────────────────────────────────────────
// YOUR custom CMS. No Sanity, no external service.
// Manage all products from here: add, edit, delete, images, stock.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import { useProducts, useImageUpload } from '@/hooks/useAdmin'
import { getImageUrl, type Product } from '@/lib/supabase'

// ─── Constants ────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'pipes',       label: 'Pipes · Burbujas' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'rolling',     label: 'Rolling' },
  { value: 'torches',     label: 'Torches' },
  { value: 'bongs',       label: 'Bongs' },
  { value: 'parts',       label: 'Parts · Repuestos' },
]

const COLORS = ['Rojo','Verde','Azul','Amarillo','Negro','Blanco','Gris','Naranja','Púrpura','Rosa','Transparente','Ahumado']
const SIZES = ['CH', 'M', 'G', 'XL', 'XXL']

const EMPTY_PRODUCT: Partial<Product> = {
  name_es: '',
  name_en: '',
  category: 'pipes',
  price_mxn: 0,
  bundle_pricing: [],
  size_cm: null,
  colors: [],
  sizes: [],
  description_es: '',
  description_en: '',
  image_paths: [],
  in_stock: true,
  featured: false,
  sort_order: 999,
}

// ─── Main Page ────────────────────────────────────────────────

export default function AdminProductsPage() {
  const { fetchProducts, createProduct, updateProduct, deleteProduct, toggleStock, loading, error } = useProducts()
  const { uploadImage, deleteImage, uploading } = useImageUpload()

  const [products, setProducts]     = useState<Product[]>([])
  const [view, setView]             = useState<'list' | 'form'>('list')
  const [editing, setEditing]       = useState<Product | null>(null)
  const [form, setForm]             = useState<Partial<Product>>(EMPTY_PRODUCT)
  const [filterCat, setFilterCat]   = useState<string>('all')
  const [search, setSearch]         = useState('')
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [newBundle, setNewBundle]   = useState({ qty: 2, price: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const data = await fetchProducts()
    setProducts(data)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_PRODUCT)
    setView('form')
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

  // ── Image upload ────────────────────────────────────────────

  async function handleImageUpload(files: FileList | null) {
    if (!files?.length) return
    const category = (form.category as string) || 'misc'

    for (const file of Array.from(files)) {
      const result = await uploadImage(file, category)
      if (result) {
        setForm(f => ({ ...f, image_paths: [...(f.image_paths || []), result.path] }))
      }
    }
  }

  async function removeImage(path: string) {
    await deleteImage(path)
    setForm(f => ({ ...f, image_paths: (f.image_paths || []).filter(p => p !== path) }))
  }

  // ── Bundle pricing ──────────────────────────────────────────

  function addBundle() {
    if (newBundle.qty < 2 || newBundle.price <= 0) return
    const bundles = [...(form.bundle_pricing || [])]
    // Replace if qty exists
    const idx = bundles.findIndex(b => b.qty === newBundle.qty)
    if (idx >= 0) bundles[idx] = newBundle
    else bundles.push(newBundle)
    bundles.sort((a, b) => a.qty - b.qty)
    setField('bundle_pricing', bundles)
    setNewBundle({ qty: newBundle.qty + 1, price: 0 })
  }

  function removeBundle(qty: number) {
    setField('bundle_pricing', (form.bundle_pricing || []).filter(b => b.qty !== qty))
  }

  // ── Save ────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.name_es || !form.category || !form.price_mxn) {
      showToast('⚠️ Nombre, categoría y precio son requeridos')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const updated = await updateProduct(editing.id, form)
        if (updated) {
          setProducts(ps => ps.map(p => p.id === updated.id ? updated : p))
          showToast('✅ Producto actualizado')
          setView('list')
        }
      } else {
        const created = await createProduct(form)
        if (created) {
          setProducts(ps => [...ps, created])
          showToast('✅ Producto creado')
          setView('list')
        }
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const ok = await deleteProduct(id)
    if (ok) {
      setProducts(ps => ps.filter(p => p.id !== id))
      showToast('🗑️ Producto eliminado')
    }
    setConfirmDelete(null)
  }

  // ── Stock toggle ────────────────────────────────────────────

  async function handleToggleStock(p: Product) {
    const newVal = !p.in_stock
    setProducts(ps => ps.map(x => x.id === p.id ? { ...x, in_stock: newVal } : x))
    const ok = await toggleStock(p.id, newVal)
    if (!ok) {
      setProducts(ps => ps.map(x => x.id === p.id ? { ...x, in_stock: p.in_stock } : x))
      showToast('Error actualizando stock')
    }
  }

  // ── Filtered products ───────────────────────────────────────

  const filtered = products.filter(p => {
    const catMatch = filterCat === 'all' || p.category === filterCat
    const searchMatch = !search || p.name_es.toLowerCase().includes(search.toLowerCase())
    return catMatch && searchMatch
  })

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="admin-page">

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal">
            <p className="modal-title">¿Eliminar producto?</p>
            <p className="modal-sub">Esta acción no se puede deshacer. Las imágenes también se eliminarán.</p>
            <div className="modal-actions">
              <button className="btn-danger" onClick={() => handleDelete(confirmDelete)}>
                Sí, eliminar
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
        <div>
          <div className="page-eyebrow">Admin Panel</div>
          <h1 className="page-title">Productos</h1>
        </div>
        {view === 'list' && (
          <button className="btn-primary" onClick={openNew}>
            + Nuevo producto
          </button>
        )}
      </div>

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <>
          {/* Filters */}
          <div className="filters">
            <input
              className="search-input"
              placeholder="Buscar producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="cat-tabs">
              <button
                className={`cat-tab ${filterCat === 'all' ? 'active' : ''}`}
                onClick={() => setFilterCat('all')}
              >
                Todos ({products.length})
              </button>
              {CATEGORIES.map(c => {
                const count = products.filter(p => p.category === c.value).length
                if (!count) return null
                return (
                  <button
                    key={c.value}
                    className={`cat-tab ${filterCat === c.value ? 'active' : ''}`}
                    onClick={() => setFilterCat(c.value)}
                  >
                    {c.label.split(' · ')[0]} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {/* Stats row */}
          <div className="stats-row">
            <div className="stat-chip">
              <span className="chip-val">{products.length}</span>
              <span className="chip-label">total</span>
            </div>
            <div className="stat-chip">
              <span className="chip-val" style={{ color: '#4ade80' }}>
                {products.filter(p => p.in_stock).length}
              </span>
              <span className="chip-label">en stock</span>
            </div>
            <div className="stat-chip">
              <span className="chip-val" style={{ color: '#f87171' }}>
                {products.filter(p => !p.in_stock).length}
              </span>
              <span className="chip-label">agotados</span>
            </div>
            <div className="stat-chip">
              <span className="chip-val" style={{ color: '#fbbf24' }}>
                {products.filter(p => p.featured).length}
              </span>
              <span className="chip-label">destacados</span>
            </div>
          </div>

          {/* Product table */}
          <div className="product-list">
            {loading && <div className="loading">Cargando productos...</div>}
            {!loading && filtered.length === 0 && (
              <div className="empty-state">
                No hay productos. <button onClick={openNew} className="link-btn">Crear el primero →</button>
              </div>
            )}
            {filtered.map(p => (
              <div key={p.id} className={`product-row ${!p.in_stock ? 'oos' : ''}`}>
                {/* Thumbnail */}
                <div className="row-thumb">
                  {p.image_paths?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getImageUrl(p.image_paths[0])} alt={p.name_es} />
                  ) : (
                    <div className="no-thumb">Sin imagen</div>
                  )}
                </div>

                {/* Info */}
                <div className="row-info">
                  <div className="row-name">{p.name_es}</div>
                  <div className="row-meta">
                    <span className="row-cat">{p.category}</span>
                    {p.size_cm && <span>· {p.size_cm} cm</span>}
                    {p.colors?.length > 0 && <span>· {p.colors.join(', ')}</span>}
                  </div>
                  {p.bundle_pricing?.length > 0 && (
                    <div className="row-bundles">
                      {p.bundle_pricing.map(b => (
                        <span key={b.qty} className="bundle-chip">{b.qty}x ${b.price}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Price */}
                <div className="row-price">${p.price_mxn}</div>

                {/* Stock toggle */}
                <div className="row-stock">
                  <button
                    className={`stock-toggle ${p.in_stock ? 'in-stock' : 'out-stock'}`}
                    onClick={() => handleToggleStock(p)}
                    title={p.in_stock ? 'En stock — click para marcar agotado' : 'Agotado — click para marcar en stock'}
                  >
                    {p.in_stock ? '✓ Stock' : '✗ Agotado'}
                  </button>
                </div>

                {/* Featured */}
                <div className="row-featured">
                  {p.featured && <span className="featured-badge">★ Destacado</span>}
                </div>

                {/* Actions */}
                <div className="row-actions">
                  <button className="action-btn edit" onClick={() => openEdit(p)}>
                    ✏️ Editar
                  </button>
                  <button className="action-btn del" onClick={() => setConfirmDelete(p.id)}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── FORM VIEW ── */}
      {view === 'form' && (
        <div className="form-container">
          <div className="form-header">
            <h2 className="form-title">
              {editing ? `Editar: ${editing.name_es}` : 'Nuevo producto'}
            </h2>
            <button className="btn-ghost" onClick={cancelForm}>← Volver</button>
          </div>

          <div className="form-grid">

            {/* ── LEFT COLUMN ── */}
            <div className="form-col">

              {/* Basic info */}
              <div className="form-section">
                <div className="section-title">Información básica</div>

                <label className="field-label">Nombre (Español) *</label>
                <input
                  className="field-input"
                  value={form.name_es || ''}
                  onChange={e => setField('name_es', e.target.value)}
                  placeholder="Ej: Burbuja Reforzada"
                />

                <label className="field-label">Name (English)</label>
                <input
                  className="field-input"
                  value={form.name_en || ''}
                  onChange={e => setField('name_en', e.target.value)}
                  placeholder="E.g. Reinforced Bubble Pipe"
                />

                <label className="field-label">Categoría *</label>
                <select
                  className="field-select"
                  value={form.category || 'pipes'}
                  onChange={e => setField('category', e.target.value as Product['category'])}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>

                <div className="field-row">
                  <div>
                    <label className="field-label">Precio MXN *</label>
                    <input
                      className="field-input"
                      type="number"
                      min="0"
                      value={form.price_mxn || ''}
                      onChange={e => setField('price_mxn', parseFloat(e.target.value) || 0)}
                      placeholder="99"
                    />
                  </div>
                  <div>
                    <label className="field-label">Tamaño (cm)</label>
                    <input
                      className="field-input"
                      type="number"
                      min="0"
                      value={form.size_cm || ''}
                      onChange={e => setField('size_cm', parseFloat(e.target.value) || null)}
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="field-label">Orden</label>
                    <input
                      className="field-input"
                      type="number"
                      min="1"
                      value={form.sort_order || 999}
                      onChange={e => setField('sort_order', parseInt(e.target.value) || 999)}
                      placeholder="1"
                    />
                  </div>
                </div>
              </div>

              {/* Bundle pricing */}
              <div className="form-section">
                <div className="section-title">Precios por volumen</div>

                {(form.bundle_pricing || []).map(b => (
                  <div key={b.qty} className="bundle-row">
                    <span className="bundle-label">{b.qty}x unidades</span>
                    <span className="bundle-price">${b.price} MXN</span>
                    <button className="remove-btn" onClick={() => removeBundle(b.qty)}>✕</button>
                  </div>
                ))}

                <div className="add-bundle-row">
                  <input
                    className="field-input"
                    type="number"
                    min="2"
                    value={newBundle.qty}
                    onChange={e => setNewBundle(b => ({ ...b, qty: parseInt(e.target.value) || 2 }))}
                    placeholder="Cant."
                    style={{ width: 70 }}
                  />
                  <span style={{ color: '#888', alignSelf: 'center' }}>×</span>
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    value={newBundle.price || ''}
                    onChange={e => setNewBundle(b => ({ ...b, price: parseFloat(e.target.value) || 0 }))}
                    placeholder="Precio"
                    style={{ width: 100 }}
                  />
                  <button className="btn-ghost-sm" onClick={addBundle}>+ Agregar</button>
                </div>
                <p className="field-hint">Ej: 2 unidades por $179, 3 unidades por $239</p>
              </div>

              {/* Colors */}
              <div className="form-section">
                <div className="section-title">Colores disponibles</div>
                <div className="color-grid">
                  {COLORS.map(c => (
                    <label key={c} className="color-checkbox">
                      <input
                        type="checkbox"
                        checked={(form.colors || []).includes(c)}
                        onChange={e => {
                          const current = form.colors || []
                          if (e.target.checked) setField('colors', [...current, c])
                          else setField('colors', current.filter(x => x !== c))
                        }}
                      />
                      <span>{c}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sizes */}
              <div className="form-section">
                <div className="section-title">Tallas (Mismo precio)</div>
                <div className="color-grid">
                  {SIZES.map(s => (
                    <label key={s} className="color-checkbox">
                      <input
                        type="checkbox"
                        checked={(form.sizes || []).includes(s)}
                        onChange={e => {
                          const current = form.sizes || []
                          if (e.target.checked) setField('sizes', [...current, s])
                          else setField('sizes', current.filter(x => x !== s))
                        }}
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>

            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="form-col">

              {/* Images */}
              <div className="form-section">
                <div className="section-title">Imágenes del producto</div>
                <p className="field-hint">PNG con fondo transparente recomendado. Máx 5MB por imagen.</p>

                {/* Upload area */}
                <div
                  className="upload-area"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
                  onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                  onDrop={e => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('drag-over')
                    handleImageUpload(e.dataTransfer.files)
                  }}
                >
                  {uploading ? (
                    <span>Subiendo imagen...</span>
                  ) : (
                    <>
                      <span className="upload-icon">📷</span>
                      <span>Click o arrastra imágenes aquí</span>
                      <span className="upload-hint">PNG · JPG · WEBP</span>
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

                {/* Image previews */}
                {(form.image_paths || []).length > 0 && (
                  <div className="image-previews">
                    {(form.image_paths || []).map(path => (
                      <div key={path} className="image-preview">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getImageUrl(path)} alt="preview" />
                        <button
                          className="remove-image-btn"
                          onClick={() => removeImage(path)}
                          title="Eliminar imagen"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Descriptions */}
              <div className="form-section">
                <div className="section-title">Descripciones</div>

                <label className="field-label">Descripción (Español)</label>
                <textarea
                  className="field-textarea"
                  value={form.description_es || ''}
                  onChange={e => setField('description_es', e.target.value)}
                  placeholder="Material, características, tamaño..."
                  rows={3}
                />

                <label className="field-label">Description (English)</label>
                <textarea
                  className="field-textarea"
                  value={form.description_en || ''}
                  onChange={e => setField('description_en', e.target.value)}
                  placeholder="Material, features, size..."
                  rows={3}
                />
              </div>

              {/* Flags */}
              <div className="form-section">
                <div className="section-title">Opciones</div>

                <label className="toggle-row">
                  <span>En stock</span>
                  <input
                    type="checkbox"
                    checked={form.in_stock ?? true}
                    onChange={e => setField('in_stock', e.target.checked)}
                  />
                </label>

                <label className="toggle-row">
                  <span>Destacado en home ★</span>
                  <input
                    type="checkbox"
                    checked={form.featured ?? false}
                    onChange={e => setField('featured', e.target.checked)}
                  />
                </label>
              </div>

            </div>
          </div>

          {/* Save bar */}
          <div className="save-bar">
            {error && <span className="save-error">{error}</span>}
            <button className="btn-ghost" onClick={cancelForm} disabled={saving}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || uploading}>
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        /* ── Layout ─────────────────────────────────────────── */
        .admin-page {
          min-height: 100vh;
          background: #111;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 0 0 80px 0;
        }

        /* ── Toast ──────────────────────────────────────────── */
        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          color: #fff;
          padding: 12px 20px;
          border-radius: 8px;
          font-size: 14px;
          z-index: 1000;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          animation: slideIn 0.2s ease;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* ── Modal ──────────────────────────────────────────── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          padding: 20px;
        }

        .modal {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 28px;
          max-width: 360px;
          width: 100%;
        }

        .modal-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
        .modal-sub   { font-size: 13px; color: #888; margin-bottom: 20px; }
        .modal-actions { display: flex; gap: 10px; }

        /* ── Header ─────────────────────────────────────────── */
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 32px 24px 24px;
          border-bottom: 1px solid #2a2a2a;
        }

        .page-eyebrow {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 4px;
        }

        .page-title {
          font-size: 24px;
          font-weight: 600;
          margin: 0;
        }

        /* ── Filters ─────────────────────────────────────────── */
        .filters {
          padding: 20px 24px 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .search-input {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          color: #fff;
          padding: 10px 14px;
          font-size: 14px;
          width: 100%;
          max-width: 360px;
        }

        .search-input::placeholder { color: #555; }
        .search-input:focus { outline: none; border-color: #CC2222; }

        .cat-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .cat-tab {
          padding: 6px 14px;
          border-radius: 20px;
          border: 0.5px solid #2a2a2a;
          background: transparent;
          color: #888;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .cat-tab:hover  { color: #fff; border-color: #555; }
        .cat-tab.active { background: #CC2222; color: #fff; border-color: #CC2222; }

        /* ── Stats ───────────────────────────────────────────── */
        .stats-row {
          display: flex;
          gap: 10px;
          padding: 16px 24px;
          flex-wrap: wrap;
        }

        .stat-chip {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: #1a1a1a;
          border: 0.5px solid #2a2a2a;
          border-radius: 8px;
          padding: 10px 16px;
          min-width: 70px;
        }

        .chip-val   { font-size: 20px; font-weight: 600; }
        .chip-label { font-size: 10px; color: #888; text-transform: uppercase; }

        /* ── Product list ────────────────────────────────────── */
        .product-list {
          display: flex;
          flex-direction: column;
          gap: 0;
          padding: 0 24px;
        }

        .product-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 0;
          border-bottom: 0.5px solid #1a1a1a;
          transition: background 0.15s;
        }

        .product-row:hover { background: #1a1a1a; margin: 0 -24px; padding-left: 24px; padding-right: 24px; }
        .product-row.oos   { opacity: 0.55; }

        .row-thumb {
          flex-shrink: 0;
          width: 52px;
          height: 52px;
          border-radius: 6px;
          overflow: hidden;
          background: #111;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .row-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .no-thumb { font-size: 9px; color: #555; text-align: center; }

        .row-info   { flex: 1; min-width: 0; }
        .row-name   { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .row-meta   { font-size: 11px; color: #888; margin-top: 2px; }
        .row-cat    { text-transform: capitalize; }

        .row-bundles    { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
        .bundle-chip    { font-size: 10px; background: #2a2a2a; padding: 2px 6px; border-radius: 4px; color: #888; }

        .row-price    { font-size: 15px; font-weight: 600; color: #CC2222; flex-shrink: 0; min-width: 60px; text-align: right; }

        .stock-toggle {
          flex-shrink: 0;
          padding: 5px 12px;
          border-radius: 20px;
          border: 0.5px solid;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .stock-toggle.in-stock  { background: rgba(74, 222, 128, 0.1); color: #4ade80; border-color: #4ade80; }
        .stock-toggle.out-stock { background: rgba(248, 113, 113, 0.1); color: #f87171; border-color: #f87171; }

        .featured-badge {
          font-size: 10px;
          color: #fbbf24;
          white-space: nowrap;
        }

        .row-actions    { display: flex; gap: 6px; flex-shrink: 0; }
        .action-btn     { padding: 6px 12px; border-radius: 6px; border: 0.5px solid #2a2a2a; background: #1a1a1a; color: #888; font-size: 12px; cursor: pointer; transition: all 0.15s; }
        .action-btn:hover { color: #fff; border-color: #555; }
        .action-btn.del:hover { color: #f87171; border-color: #f87171; }

        .loading, .empty-state { padding: 40px 0; text-align: center; color: #888; font-size: 14px; }
        .link-btn { background: none; border: none; color: #CC2222; cursor: pointer; text-decoration: underline; font-size: 14px; }

        /* ── Buttons ─────────────────────────────────────────── */
        .btn-primary {
          padding: 10px 20px;
          background: #CC2222;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }

        .btn-primary:hover:not(:disabled) { background: #e02222; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-secondary {
          padding: 10px 20px;
          background: #1a1a1a;
          color: #fff;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
        }

        .btn-danger {
          padding: 10px 20px;
          background: transparent;
          color: #f87171;
          border: 1px solid #f87171;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
        }

        .btn-ghost {
          padding: 10px 16px;
          background: transparent;
          color: #888;
          border: 0.5px solid #2a2a2a;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-ghost:hover { color: #fff; border-color: #555; }

        .btn-ghost-sm {
          padding: 8px 12px;
          background: transparent;
          color: #888;
          border: 0.5px solid #2a2a2a;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        }

        .btn-ghost-sm:hover { color: #fff; }

        /* ── Form ────────────────────────────────────────────── */
        .form-container { padding: 0 24px; }

        .form-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 0 20px;
          border-bottom: 1px solid #2a2a2a;
          margin-bottom: 24px;
        }

        .form-title { font-size: 18px; font-weight: 600; margin: 0; }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0;
        }

        @media (min-width: 900px) {
          .form-grid { grid-template-columns: 1fr 1fr; gap: 24px; }
        }

        .form-col { display: flex; flex-direction: column; gap: 0; }

        .form-section {
          background: #1a1a1a;
          border: 0.5px solid #2a2a2a;
          border-radius: 10px;
          padding: 18px;
          margin-bottom: 16px;
        }

        .section-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #888;
          margin-bottom: 14px;
        }

        .field-label {
          display: block;
          font-size: 12px;
          color: #888;
          margin-bottom: 6px;
          margin-top: 12px;
        }

        .field-label:first-of-type { margin-top: 0; }

        .field-input, .field-select, .field-textarea {
          width: 100%;
          background: #111;
          border: 0.5px solid #2a2a2a;
          border-radius: 6px;
          color: #fff;
          padding: 10px 12px;
          font-size: 13px;
          font-family: inherit;
        }

        .field-input:focus, .field-select:focus, .field-textarea:focus {
          outline: none;
          border-color: #CC2222;
        }

        .field-select { cursor: pointer; }
        .field-textarea { resize: vertical; min-height: 80px; }

        .field-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 12px; }
        .field-hint { font-size: 11px; color: #555; margin-top: 8px; }

        /* Bundle rows */
        .bundle-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 10px;
          background: #111;
          border-radius: 6px;
          margin-bottom: 6px;
          font-size: 13px;
        }

        .bundle-label { flex: 1; color: #888; }
        .bundle-price { font-weight: 600; color: #CC2222; }
        .remove-btn { background: none; border: none; color: #555; cursor: pointer; font-size: 14px; }
        .remove-btn:hover { color: #f87171; }

        .add-bundle-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
        }

        /* Color checkboxes */
        .color-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 8px;
        }

        .color-checkbox {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #888;
          cursor: pointer;
        }

        .color-checkbox input { accent-color: #CC2222; }
        .color-checkbox:hover span { color: #fff; }

        /* Upload */
        .upload-area {
          border: 1px dashed #2a2a2a;
          border-radius: 8px;
          padding: 32px 20px;
          text-align: center;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #888;
          transition: all 0.2s;
        }

        .upload-area:hover, .upload-area.drag-over {
          border-color: #CC2222;
          background: rgba(204, 34, 34, 0.05);
          color: #fff;
        }

        .upload-icon { font-size: 28px; }
        .upload-hint { font-size: 11px; color: #555; }

        .image-previews {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 8px;
          margin-top: 12px;
        }

        .image-preview {
          position: relative;
          aspect-ratio: 1;
          border-radius: 6px;
          overflow: hidden;
          background: #111;
        }

        .image-preview img { width: 100%; height: 100%; object-fit: contain; }

        .remove-image-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(0,0,0,0.8);
          color: #fff;
          border: none;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          font-size: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .remove-image-btn:hover { background: #CC2222; }

        /* Toggle rows */
        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 0.5px solid #2a2a2a;
          font-size: 13px;
          color: #fff;
          cursor: pointer;
        }

        .toggle-row:last-child { border-bottom: none; }
        .toggle-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: #CC2222; cursor: pointer; }

        /* Save bar */
        .save-bar {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
          padding: 20px 0;
          border-top: 1px solid #2a2a2a;
          margin-top: 20px;
          position: sticky;
          bottom: 0;
          background: #111;
        }

        .save-error { font-size: 13px; color: #f87171; margin-right: auto; }
      `}</style>
    </div>
  )
}
