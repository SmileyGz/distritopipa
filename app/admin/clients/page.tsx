'use client'
// app/admin/clients/page.tsx
// ─────────────────────────────────────────────────────────────
// Distrito Pipa — Directorio de Clientes & CRM Individual
// Alineado al Brand Board: Rojo Eléctrico, Negro Carbón, Bebas Neue
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react'
import { adminFetch } from '@/hooks/useAdmin'
import { getVIPStatus, getTierColor, getTierIcon, type VIPStatus } from '@/lib/clients'
import toast from 'react-hot-toast'

interface OrderItem {
  name: string
  qty: number
  unit_price: number
  color?: string
}

interface Order {
  id: string
  order_number: string
  status: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  delivery_address?: string
  total_mxn: number
  created_at: string
  items?: OrderItem[]
  payment_mode?: string
}

export type ClientSegment = 'nuevo' | 'recurrente' | 'vip' | 'comunidad'

export interface ClientProfile {
  phone: string
  name: string
  email: string
  address: string
  notes: string
  birthday: string
  totalSpent: number      // VIP progress (Real spent + Points)
  realSpent: number       // Real money spent
  orderCount: number
  lastOrderDate: string
  firstOrderDate: string
  vipStatus: VIPStatus
  orders: Order[]
  communityPoints: number
  questionsCount: number
  answersCount: number
  segment: ClientSegment
}

type SortField = 'recent' | 'name' | 'spent' | 'orders'
type FilterTier = 'all' | 'Oro' | 'Plata' | 'Bronce' | 'recurrente' | 'nuevo'

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('recent')
  const [filterTier, setFilterTier] = useState<FilterTier>('all')
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null)
  
  // Inline editing states inside drawer
  const [editingField, setEditingField] = useState<'name' | 'phone' | 'email' | 'address' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [notesDraft, setNotesDraft] = useState('')

  // Load clients & CRM metadata
  const load = useCallback(async () => {
    setLoading(true)
    let orders: Order[] = []

    const storedBirthdays = JSON.parse(localStorage.getItem('dp_client_birthdays') || '{}')
    const storedNotes = JSON.parse(localStorage.getItem('dp_client_notes') || '{}')
    const storedEmails = JSON.parse(localStorage.getItem('dp_client_emails') || '{}')
    const storedNames = JSON.parse(localStorage.getItem('dp_client_names') || '{}')
    const storedAddresses = JSON.parse(localStorage.getItem('dp_client_addresses') || '{}')

    if (process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co' || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      orders = JSON.parse(localStorage.getItem('dp_mock_orders') || '[]')
    } else {
      try {
        const res = await adminFetch('/api/admin/orders')
        const json = await res.json()
        if (res.ok && json.orders) {
          orders = json.orders as Order[]
        }
      } catch (err) {
        console.error(err)
      }
    }

    // Group orders by clean phone number
    const grouped = orders.reduce((acc, order) => {
      const cp = order.customer_phone || ''
      const phone = cp.replace(/\D/g, '') || cp
      if (!phone) return acc

      if (!acc[phone]) {
        acc[phone] = {
          phone,
          name: storedNames[phone] || order.customer_name || 'Cliente',
          email: storedEmails[phone] || order.customer_email || '',
          address: storedAddresses[phone] || order.delivery_address || '',
          notes: storedNotes[phone] || '',
          birthday: storedBirthdays[phone] || '',
          totalSpent: 0,
          realSpent: 0,
          orderCount: 0,
          lastOrderDate: order.created_at,
          firstOrderDate: order.created_at,
          orders: [],
        }
      }

      // Preserve most complete email & address
      if (!acc[phone].email && order.customer_email) {
        acc[phone].email = order.customer_email
      }
      if (!acc[phone].address && order.delivery_address && order.delivery_address !== 'Pickup Local') {
        acc[phone].address = order.delivery_address
      }

      // Track dates
      if (new Date(order.created_at) > new Date(acc[phone].lastOrderDate)) {
        acc[phone].lastOrderDate = order.created_at
        if (!storedNames[phone] && order.customer_name) {
          acc[phone].name = order.customer_name
        }
        if (!storedEmails[phone] && order.customer_email) {
          acc[phone].email = order.customer_email
        }
        if (!storedAddresses[phone] && order.delivery_address && order.delivery_address !== 'Pickup Local') {
          acc[phone].address = order.delivery_address
        }
      }

      if (new Date(order.created_at) < new Date(acc[phone].firstOrderDate)) {
        acc[phone].firstOrderDate = order.created_at
      }

      // Total and order counts (exclude cancelled orders from spend)
      if (order.status !== 'cancelled') {
        acc[phone].totalSpent += order.total_mxn || 0
        acc[phone].realSpent += order.total_mxn || 0
        acc[phone].orderCount += 1
      }

      acc[phone].orders.push(order)
      return acc
    }, {} as Record<string, any>)

    // Community engagement points
    const posts = JSON.parse(localStorage.getItem('dp_mock_community_posts') || '[]')
    const answerCounts: Record<string, number> = {}
    const questionCounts: Record<string, number> = {}
    const communityNames: Record<string, string> = {}

    posts.forEach((p: any) => {
      const authorPhone = p.author?.phone?.replace(/\D/g, '')
      if (authorPhone) {
        questionCounts[authorPhone] = (questionCounts[authorPhone] || 0) + 1
        communityNames[authorPhone] = p.author.nickname
      }

      p.answers?.forEach((ans: any) => {
        const ansAuthorPhone = ans.author?.phone?.replace(/\D/g, '')
        if (ansAuthorPhone) {
          answerCounts[ansAuthorPhone] = (answerCounts[ansAuthorPhone] || 0) + 1
          communityNames[ansAuthorPhone] = ans.author.nickname
        }
      })
    })

    // Include community users who have not ordered yet
    Object.keys(communityNames).forEach(phone => {
      if (!grouped[phone]) {
        grouped[phone] = {
          phone,
          name: storedNames[phone] || `${communityNames[phone]} (Comunidad)`,
          email: storedEmails[phone] || '',
          address: storedAddresses[phone] || '',
          notes: storedNotes[phone] || '',
          birthday: storedBirthdays[phone] || '',
          totalSpent: 0,
          realSpent: 0,
          orderCount: 0,
          lastOrderDate: new Date().toISOString(),
          firstOrderDate: new Date().toISOString(),
          orders: [],
        }
      }
    })

    // Construct final client profiles with VIP & Segment
    const clientsList: ClientProfile[] = Object.values(grouped).map((c: any) => {
      const qCount = questionCounts[c.phone] || 0
      const aCount = answerCounts[c.phone] || 0
      const gamificationPoints = aCount * 40
      const newTotalSpent = c.realSpent + gamificationPoints

      // Sort client own orders newest first
      c.orders.sort((a: Order, b: Order) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      let segment: ClientSegment = 'nuevo'
      if (c.orderCount === 0) segment = 'comunidad'
      else if (newTotalSpent >= 5000) segment = 'vip'
      else if (c.orderCount >= 2) segment = 'recurrente'
      else segment = 'nuevo'

      return {
        ...c,
        totalSpent: newTotalSpent,
        communityPoints: gamificationPoints,
        questionsCount: qCount,
        answersCount: aCount,
        vipStatus: getVIPStatus(newTotalSpent),
        segment,
      }
    })

    setClients(clientsList)
    setLoading(false)

    // Keep selectedClient state in sync if drawer is open
    setSelectedClient(prev => {
      if (!prev) return null
      return clientsList.find(c => c.phone === prev.phone) || null
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ESC to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedClient(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 1-Click Copy Helper with toast
  const copyToClipboard = async (text: string, label: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!text) {
      toast.error(`No hay ${label.toLowerCase()} registrado`)
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado`, { id: `copy-${label}` })
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  // Master Booking / Dispatch Dossier
  const copyBookingDossier = async (client: ClientProfile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const text = [
      `📍 FICHA DE ENTREGA — DISTRITO PIPA`,
      `👤 Cliente: ${client.name}`,
      `📱 Teléfono: ${client.phone}`,
      `📧 Email: ${client.email || 'No registrado'}`,
      `🏠 Dirección: ${client.address || 'Punto de entrega / A coordinar'}`,
      `🛍️ Historial: ${client.orderCount} pedido(s) ($${client.realSpent.toLocaleString('es-MX')} MXN)`,
      `⭐ Nivel VIP: ${client.vipStatus.tier}`,
      client.notes ? `📝 Notas: ${client.notes}` : `📝 Notas: Sin observaciones`,
    ].join('\n')

    await copyToClipboard(text, 'Ficha para Booking')
  }

  // Save CRM fields locally & refresh
  const saveCrmField = (phone: string, field: 'name' | 'phone' | 'email' | 'address' | 'notes' | 'birthday', value: string) => {
    const storageKeys: Record<string, string> = {
      name: 'dp_client_names',
      phone: 'dp_client_phones',
      email: 'dp_client_emails',
      address: 'dp_client_addresses',
      notes: 'dp_client_notes',
      birthday: 'dp_client_birthdays',
    }
    const key = storageKeys[field]
    if (!key) return

    const current = JSON.parse(localStorage.getItem(key) || '{}')
    current[phone] = value
    localStorage.setItem(key, JSON.stringify(current))

    toast.success('Actualizado correctamente')
    setEditingField(null)
    load()
  }

  // Filter & Sort Pipeline
  const filteredAndSortedClients = useMemo(() => {
    let result = [...clients]

    // Search filter (name, phone, email, address)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      result = result.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.address.toLowerCase().includes(term)
      )
    }

    // Tier/Segment filter
    if (filterTier === 'Oro' || filterTier === 'Plata' || filterTier === 'Bronce') {
      result = result.filter(c => c.vipStatus.tier === filterTier)
    } else if (filterTier === 'recurrente') {
      result = result.filter(c => c.orderCount >= 2)
    } else if (filterTier === 'nuevo') {
      result = result.filter(c => c.orderCount === 1)
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortField) {
        case 'recent':
          return new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime()
        case 'name':
          return (a.name || '').localeCompare(b.name || '')
        case 'spent':
          return b.totalSpent - a.totalSpent
        case 'orders':
          return b.orderCount - a.orderCount
        default:
          return 0
      }
    })

    return result
  }, [clients, searchTerm, filterTier, sortField])

  // Aggregate stats
  const stats = useMemo(() => ({
    total: clients.length,
    recurrentes: clients.filter(c => c.orderCount >= 2).length,
    nuevos: clients.filter(c => c.orderCount === 1).length,
    oro: clients.filter(c => c.vipStatus.tier === 'Oro').length,
    plata: clients.filter(c => c.vipStatus.tier === 'Plata').length,
    bronce: clients.filter(c => c.vipStatus.tier === 'Bronce').length,
    totalVentas: clients.reduce((acc, c) => acc + c.realSpent, 0),
  }), [clients])

  const openProfile = (client: ClientProfile) => {
    setSelectedClient(client)
    setNotesDraft(client.notes || '')
    setEditingField(null)
  }

  return (
    <div className="clients-page">
      {/* ── HEADER ── */}
      <header className="page-header">
        <div>
          <div className="page-eyebrow">DISTRITO PIPA CANCÚN · CRM & CLIENTES</div>
          <h1 className="page-title">Directorio de Clientes</h1>
          <p className="page-subtitle">
            Base de compradores locales, historial de pedidos y fichas de despacho rápido.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-outline" onClick={load}>
            <span className="btn-icon">↺</span> Actualizar
          </button>
        </div>
      </header>

      {/* ── METRICS ROW (Brand Board: Bebas Neue + Dark Cards) ── */}
      <div className="stats-container">
        <div className="stat-card">
          <span className="stat-label">Total Clientes</span>
          <span className="stat-val">{stats.total}</span>
          <span className="stat-sub">${stats.totalVentas.toLocaleString('es-MX')} MXN ventas</span>
        </div>
        <div className="stat-card" onClick={() => setFilterTier(filterTier === 'recurrente' ? 'all' : 'recurrente')}>
          <span className="stat-label">🔄 Compradores Recurrentes</span>
          <span className="stat-val" style={{ color: '#DC143C' }}>{stats.recurrentes}</span>
          <span className="stat-sub">Meta Brand Board: 20</span>
        </div>
        <div className="stat-card" onClick={() => setFilterTier(filterTier === 'nuevo' ? 'all' : 'nuevo')}>
          <span className="stat-label">🆕 Clientes Nuevos</span>
          <span className="stat-val" style={{ color: '#60a5fa' }}>{stats.nuevos}</span>
          <span className="stat-sub">1 compra realizada</span>
        </div>
        <div className="stat-card" onClick={() => setFilterTier(filterTier === 'Oro' ? 'all' : 'Oro')}>
          <span className="stat-label">🥇 Nivel Oro ($10k+)</span>
          <span className="stat-val" style={{ color: getTierColor('Oro') }}>{stats.oro}</span>
          <span className="stat-sub">Clientes VIP Elite</span>
        </div>
      </div>

      {/* ── CONTROLS: SEARCH, FILTERS & SORTING ── */}
      <div className="controls-bar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono, correo o dirección..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>✕</button>
          )}
        </div>

        <div className="sort-wrap">
          <label className="sort-label">Ordenar por:</label>
          <select
            value={sortField}
            onChange={e => setSortField(e.target.value as SortField)}
            className="select-sort"
          >
            <option value="recent">🕒 Más reciente (Último pedido)</option>
            <option value="name">🔤 Alfabético (A - Z)</option>
            <option value="spent">💰 Mayor inversión (Gasto Total)</option>
            <option value="orders">📦 Más pedidos realizados</option>
          </select>
        </div>
      </div>

      {/* ── FILTER PILLS ── */}
      <div className="pills-container">
        <button
          className={`pill ${filterTier === 'all' ? 'active' : ''}`}
          onClick={() => setFilterTier('all')}
        >
          Todos ({stats.total})
        </button>
        <button
          className={`pill ${filterTier === 'recurrente' ? 'active' : ''}`}
          onClick={() => setFilterTier('recurrente')}
        >
          🔄 Recurrentes ({stats.recurrentes})
        </button>
        <button
          className={`pill ${filterTier === 'nuevo' ? 'active' : ''}`}
          onClick={() => setFilterTier('nuevo')}
        >
          🆕 Nuevos ({stats.nuevos})
        </button>
        <button
          className={`pill ${filterTier === 'Oro' ? 'active' : ''}`}
          onClick={() => setFilterTier('Oro')}
          style={{ borderColor: filterTier === 'Oro' ? getTierColor('Oro') : '' }}
        >
          🥇 Oro ({stats.oro})
        </button>
        <button
          className={`pill ${filterTier === 'Plata' ? 'active' : ''}`}
          onClick={() => setFilterTier('Plata')}
          style={{ borderColor: filterTier === 'Plata' ? getTierColor('Plata') : '' }}
        >
          🥈 Plata ({stats.plata})
        </button>
        <button
          className={`pill ${filterTier === 'Bronce' ? 'active' : ''}`}
          onClick={() => setFilterTier('Bronce')}
          style={{ borderColor: filterTier === 'Bronce' ? getTierColor('Bronce') : '' }}
        >
          🥉 Bronce ({stats.bronce})
        </button>
      </div>

      {/* ── CLIENT LIST ── */}
      <div className="clients-list">
        {loading && (
          <div className="state-box">
            <div className="spinner"></div>
            <p>Cargando directorio y sincronizando pedidos...</p>
          </div>
        )}

        {!loading && filteredAndSortedClients.length === 0 && (
          <div className="state-box">
            <p>No se encontraron clientes con el criterio seleccionado.</p>
            <button className="btn-outline" onClick={() => { setSearchTerm(''); setFilterTier('all') }}>
              Restablecer filtros
            </button>
          </div>
        )}

        {!loading && filteredAndSortedClients.map(client => {
          const tierColor = getTierColor(client.vipStatus.tier)
          const initials = client.name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'DP'

          return (
            <div
              key={client.phone}
              className={`client-row ${selectedClient?.phone === client.phone ? 'selected' : ''}`}
              onClick={() => openProfile(client)}
            >
              {/* Avatar with initials */}
              <div className="avatar-circle" style={{ borderColor: tierColor }}>
                {initials}
              </div>

              {/* Identity and Quick Copy */}
              <div className="client-main-info">
                <div className="client-name-row">
                  <span className="client-name">{client.name}</span>
                  {client.orderCount >= 2 && (
                    <span className="badge-recurrente">🔄 Recurrente ({client.orderCount})</span>
                  )}
                  {client.vipStatus.tier !== 'Ninguno' && (
                    <span className="badge-tier" style={{ color: tierColor, borderColor: tierColor, background: `${tierColor}15` }}>
                      {getTierIcon(client.vipStatus.tier)} {client.vipStatus.tier}
                    </span>
                  )}
                </div>

                <div className="contact-snippets">
                  {/* Phone with 1-click copy */}
                  <span className="contact-tag" title="Copiar Teléfono" onClick={e => copyToClipboard(client.phone, 'Teléfono', e)}>
                    <span className="tag-icon">📱</span>
                    <strong className="tag-val">{client.phone}</strong>
                    <button className="copy-btn-mini" aria-label="Copiar teléfono">📋</button>
                  </span>

                  {/* Email with 1-click copy */}
                  {client.email ? (
                    <span className="contact-tag" title="Copiar Correo" onClick={e => copyToClipboard(client.email, 'Correo', e)}>
                      <span className="tag-icon">📧</span>
                      <span className="tag-val">{client.email}</span>
                      <button className="copy-btn-mini" aria-label="Copiar correo">📋</button>
                    </span>
                  ) : (
                    <span className="contact-tag missing" title="Sin correo registrado">
                      <span className="tag-icon">📧</span>
                      <span className="tag-val">Sin email</span>
                    </span>
                  )}

                  {/* Address Snippet */}
                  {client.address && (
                    <span className="contact-tag address" title="Copiar Dirección" onClick={e => copyToClipboard(client.address, 'Dirección', e)}>
                      <span className="tag-icon">📍</span>
                      <span className="tag-val truncate">{client.address}</span>
                      <button className="copy-btn-mini" aria-label="Copiar dirección">📋</button>
                    </span>
                  )}
                </div>
              </div>

              {/* Spend & Recency */}
              <div className="client-metrics-col">
                <div className="metrics-total">${client.realSpent.toLocaleString('es-MX')} MXN</div>
                <div className="metrics-orders">
                  {client.orderCount} {client.orderCount === 1 ? 'pedido' : 'pedidos'}
                </div>
                <div className="metrics-date">
                  Último: {new Date(client.lastOrderDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>

              {/* Actions & Dispatch */}
              <div className="client-actions-col" onClick={e => e.stopPropagation()}>
                <button
                  className="btn-booking-shortcut"
                  title="Copiar Ficha completa para Booking / Mensajería"
                  onClick={e => copyBookingDossier(client, e)}
                >
                  📋 Ficha Booking
                </button>
                <a
                  href={`https://wa.me/${client.phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-wa-shortcut"
                  title="Chatear por WhatsApp"
                >
                  💬 WhatsApp
                </a>
                <button
                  className="btn-profile-open"
                  onClick={() => openProfile(client)}
                  title="Abrir perfil completo"
                >
                  Ver Perfil ↗
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── SLIDE-OVER DRAWER: PERFIL INDIVIDUAL DE CLIENTE ── */}
      {selectedClient && (
        <div className="drawer-overlay" onClick={() => setSelectedClient(null)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            {/* Drawer Top Header */}
            <div className="drawer-header">
              <div className="drawer-eyebrow">FICHA INDIVIDUAL DE CLIENTE</div>
              <button className="drawer-close-btn" onClick={() => setSelectedClient(null)} aria-label="Cerrar">
                ✕
              </button>
            </div>

            {/* Profile Hero */}
            <div className="profile-hero">
              <div
                className="profile-avatar"
                style={{ borderColor: getTierColor(selectedClient.vipStatus.tier) }}
              >
                {selectedClient.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'DP'}
              </div>

              <div className="profile-identity">
                {editingField === 'name' ? (
                  <div className="inline-edit-box">
                    <input
                      type="text"
                      className="input-sleek"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      autoFocus
                    />
                    <button
                      className="btn-primary-sm"
                      onClick={() => saveCrmField(selectedClient.phone, 'name', editValue)}
                    >
                      Guardar
                    </button>
                    <button className="btn-ghost-sm" onClick={() => setEditingField(null)}>Cancelar</button>
                  </div>
                ) : (
                  <div className="hero-name-row">
                    <h2 className="profile-name">{selectedClient.name}</h2>
                    <button
                      className="btn-edit-text"
                      onClick={() => { setEditingField('name'); setEditValue(selectedClient.name); }}
                      title="Editar nombre"
                    >
                      ✏️
                    </button>
                  </div>
                )}

                <div className="profile-badges">
                  <span
                    className="badge-tier"
                    style={{
                      color: getTierColor(selectedClient.vipStatus.tier),
                      borderColor: getTierColor(selectedClient.vipStatus.tier),
                      background: `${getTierColor(selectedClient.vipStatus.tier)}20`,
                    }}
                  >
                    {getTierIcon(selectedClient.vipStatus.tier)} Nivel {selectedClient.vipStatus.tier}
                  </span>

                  <span className="badge-segment">
                    {selectedClient.orderCount === 0 && 'Comunidad'}
                    {selectedClient.orderCount === 1 && '🆕 Cliente Nuevo'}
                    {selectedClient.orderCount >= 2 && '🔄 Comprador Recurrente'}
                  </span>
                </div>
              </div>
            </div>

            {/* Fast Booking Dispatch Bar (Key Feature requested!) */}
            <div className="booking-cta-box">
              <div className="booking-cta-info">
                <strong>¿Vas a coordinar una entrega o booking?</strong>
                <span>Copia la ficha completa formateada lista para pegar en WhatsApp o enviar al mensajero.</span>
              </div>
              <button
                className="btn-copy-dossier-large"
                onClick={() => copyBookingDossier(selectedClient)}
              >
                📋 Copiar Ficha Completa para Booking
              </button>
            </div>

            {/* Direct Communication Bar */}
            <div className="action-button-row">
              <a
                href={`https://wa.me/${selectedClient.phone}?text=${encodeURIComponent(`Hola ${selectedClient.name}, te escribimos de Distrito Pipa Cancún:`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-action-channel whatsapp"
              >
                💬 WhatsApp
              </a>

              {selectedClient.email ? (
                <a
                  href={`mailto:${selectedClient.email}?subject=${encodeURIComponent('Distrito Pipa Cancún — Seguimiento de Pedido')}`}
                  className="btn-action-channel email"
                >
                  ✉️ Enviar Correo
                </a>
              ) : null}

              <a
                href={`tel:${selectedClient.phone}`}
                className="btn-action-channel call"
              >
                📞 Llamar
              </a>
            </div>

            {/* Contact Dossier Cards */}
            <div className="section-card">
              <h3 className="section-title">Datos de Contacto & Despacho</h3>

              <div className="fields-grid">
                {/* Phone Field */}
                <div className="field-item">
                  <span className="field-label">Teléfono WhatsApp</span>
                  {editingField === 'phone' ? (
                    <div className="inline-edit-box">
                      <input
                        type="tel"
                        className="input-sleek"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        autoFocus
                      />
                      <button className="btn-primary-sm" onClick={() => saveCrmField(selectedClient.phone, 'phone', editValue)}>Guardar</button>
                      <button className="btn-ghost-sm" onClick={() => setEditingField(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <div className="field-content-row">
                      <strong className="field-value phone-val">{selectedClient.phone}</strong>
                      <div className="field-actions">
                        <button className="btn-field-copy" onClick={() => copyToClipboard(selectedClient.phone, 'Teléfono')}>📋 Copiar</button>
                        <button className="btn-field-edit" onClick={() => { setEditingField('phone'); setEditValue(selectedClient.phone); }}>✏️</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Email Field */}
                <div className="field-item">
                  <span className="field-label">Correo Electrónico</span>
                  {editingField === 'email' ? (
                    <div className="inline-edit-box">
                      <input
                        type="email"
                        className="input-sleek"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        placeholder="cliente@ejemplo.com"
                        autoFocus
                      />
                      <button className="btn-primary-sm" onClick={() => saveCrmField(selectedClient.phone, 'email', editValue)}>Guardar</button>
                      <button className="btn-ghost-sm" onClick={() => setEditingField(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <div className="field-content-row">
                      <span className={`field-value ${selectedClient.email ? '' : 'placeholder'}`}>
                        {selectedClient.email || 'No registrado aún'}
                      </span>
                      <div className="field-actions">
                        {selectedClient.email && (
                          <button className="btn-field-copy" onClick={() => copyToClipboard(selectedClient.email, 'Correo')}>📋 Copiar</button>
                        )}
                        <button className="btn-field-edit" onClick={() => { setEditingField('email'); setEditValue(selectedClient.email || ''); }}>✏️</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delivery Address */}
                <div className="field-item full-width">
                  <span className="field-label">Dirección Habitual de Entrega</span>
                  {editingField === 'address' ? (
                    <div className="inline-edit-box">
                      <textarea
                        className="input-sleek textarea-sm"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        placeholder="Región, Manzana, Lote, Calle y Referencias en Cancún"
                        autoFocus
                      />
                      <div className="edit-btn-row">
                        <button className="btn-primary-sm" onClick={() => saveCrmField(selectedClient.phone, 'address', editValue)}>Guardar</button>
                        <button className="btn-ghost-sm" onClick={() => setEditingField(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="field-content-row">
                      <span className={`field-value ${selectedClient.address ? '' : 'placeholder'}`}>
                        {selectedClient.address || 'Sin dirección registrada (Pickup / A coordinar)'}
                      </span>
                      <div className="field-actions">
                        {selectedClient.address && (
                          <button className="btn-field-copy" onClick={() => copyToClipboard(selectedClient.address, 'Dirección')}>📋 Copiar</button>
                        )}
                        <button className="btn-field-edit" onClick={() => { setEditingField('address'); setEditValue(selectedClient.address || ''); }}>✏️</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Birthday Selector */}
                <div className="field-item">
                  <span className="field-label">Cumpleaños (Beneficios & Descuentos)</span>
                  <input
                    type="date"
                    className="input-date"
                    value={selectedClient.birthday || ''}
                    onChange={e => saveCrmField(selectedClient.phone, 'birthday', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Internal CRM Notes */}
            <div className="section-card">
              <div className="section-header-flex">
                <h3 className="section-title">Notas Internas & Preferencias del Cliente</h3>
                <span className="section-tip">Guardado automático local</span>
              </div>
              <textarea
                className="input-sleek textarea-notes"
                placeholder="Ejemplo: Prefiere entregas después de 8pm. Punto de entrega Soriana Nichupté. Le gusta el cristal grueso."
                value={notesDraft}
                onChange={e => {
                  setNotesDraft(e.target.value)
                  const current = JSON.parse(localStorage.getItem('dp_client_notes') || '{}')
                  current[selectedClient.phone] = e.target.value
                  localStorage.setItem('dp_client_notes', JSON.stringify(current))
                }}
              />
            </div>

            {/* VIP & Gamification Progress */}
            <div className="section-card">
              <h3 className="section-title">Estatus de Fidelidad (VIP)</h3>
              <div className="vip-box">
                <div className="vip-metric-row">
                  <div>
                    <span className="vip-metric-title">Gasto Real en Pedidos:</span>
                    <strong className="vip-metric-val">${selectedClient.realSpent.toLocaleString('es-MX')} MXN</strong>
                  </div>
                  {selectedClient.communityPoints > 0 && (
                    <div>
                      <span className="vip-metric-title">Puntos Comunidad:</span>
                      <strong className="vip-metric-val" style={{ color: '#DC143C' }}>+${selectedClient.communityPoints.toLocaleString('es-MX')}</strong>
                    </div>
                  )}
                  <div>
                    <span className="vip-metric-title">Puntaje Total VIP:</span>
                    <strong className="vip-metric-val" style={{ color: getTierColor(selectedClient.vipStatus.tier) }}>
                      ${selectedClient.totalSpent.toLocaleString('es-MX')}
                    </strong>
                  </div>
                </div>

                {selectedClient.vipStatus.nextTier ? (
                  <div className="vip-progress-block">
                    <div className="vip-progress-info">
                      <span>Faltan <strong>${selectedClient.vipStatus.amountToNextTier?.toLocaleString('es-MX')} MXN</strong> para nivel <strong>{selectedClient.vipStatus.nextTier}</strong></span>
                    </div>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${Math.min(100, (selectedClient.totalSpent / (selectedClient.totalSpent + (selectedClient.vipStatus.amountToNextTier || 1))) * 100)}%`,
                          background: getTierColor(selectedClient.vipStatus.nextTier),
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="vip-max-achieved">
                    🏆 ¡Cliente en el nivel más alto de lealtad (Oro)!
                  </div>
                )}
              </div>
            </div>

            {/* Complete Order History */}
            <div className="section-card">
              <div className="section-header-flex">
                <h3 className="section-title">Historial de Compras ({selectedClient.orders.length})</h3>
                <a href="/admin/orders" className="orders-link">Ver cola de pedidos ↗</a>
              </div>

              {selectedClient.orders.length === 0 ? (
                <div className="empty-orders">Este cliente aún no tiene pedidos registrados.</div>
              ) : (
                <div className="orders-table">
                  {selectedClient.orders.map(order => (
                    <div key={order.id} className={`order-history-row ${order.status === 'cancelled' ? 'cancelled' : ''}`}>
                      <div className="order-row-main">
                        <div className="order-row-num">
                          <strong>#{order.order_number}</strong>
                          <span className="order-row-date">
                            {new Date(order.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="order-row-status">
                          <span className={`status-pill ${order.status}`}>{order.status}</span>
                        </div>
                      </div>

                      {order.items && order.items.length > 0 && (
                        <div className="order-items-snippet">
                          {order.items.map((it, idx) => (
                            <span key={idx} className="item-pill">
                              {it.qty}x {it.name} {it.color ? `(${it.color})` : ''}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="order-row-total">
                        Total: <strong>${order.total_mxn?.toLocaleString('es-MX')} MXN</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Danger Zone */}
            <div className="danger-zone">
              <button
                className="btn-danger-wipe"
                onClick={async () => {
                  if (confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${selectedClient.name} y todo su historial de pedidos? Esta acción no se puede deshacer.`)) {
                    try {
                      const res = await adminFetch(`/api/admin/clients?phone=${encodeURIComponent(selectedClient.phone)}`, { method: 'DELETE' })
                      if (res.ok) {
                        toast.success('Cliente eliminado')
                        setSelectedClient(null)
                        load()
                      } else {
                        const err = await res.json()
                        toast.error(`Error: ${err.error}`)
                      }
                    } catch (e: any) {
                      toast.error('Error al eliminar cliente')
                    }
                  }
                }}
              >
                🗑️ Eliminar Cliente y su Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STYLES (Brand Board: Red #DC143C, Charcoal #1A1A1A, Concrete #2A2A2A) ── */}
      <style>{`
        .clients-page {
          min-height: 100vh;
          background-color: #111111;
          color: #ffffff;
          padding: 24px 20px 80px;
          font-family: var(--font-inter), system-ui, sans-serif;
        }

        /* ── Header ── */
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 20px;
          border-bottom: 1px solid #2a2a2a;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .page-eyebrow {
          font-size: 11px;
          color: #DC143C;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .page-title {
          font-family: var(--font-bebas), sans-serif;
          font-size: clamp(32px, 5vw, 44px);
          letter-spacing: 0.04em;
          line-height: 1;
          margin-bottom: 6px;
        }
        .page-subtitle {
          color: #888888;
          font-size: 14px;
        }
        .header-actions {
          display: flex;
          gap: 10px;
        }

        /* ── Stats Row ── */
        .stats-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: border-color 0.2s, transform 0.1s;
        }
        .stat-card:hover {
          border-color: #DC143C;
          transform: translateY(-2px);
        }
        .stat-label {
          font-size: 11px;
          color: #888888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .stat-val {
          font-family: var(--font-bebas), sans-serif;
          font-size: 36px;
          line-height: 1;
          color: #ffffff;
          margin-bottom: 4px;
        }
        .stat-sub {
          font-size: 12px;
          color: #666666;
        }

        /* ── Controls Bar ── */
        .controls-bar {
          display: flex;
          gap: 16px;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .search-wrap {
          position: relative;
          flex: 1;
          min-width: 280px;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 14px;
          opacity: 0.6;
        }
        .search-input {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 10px 36px 10px 36px;
          color: #fff;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        .search-input:focus {
          outline: none;
          border-color: #DC143C;
        }
        .clear-search {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
        }

        .sort-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .sort-label {
          font-size: 12px;
          color: #888888;
          white-space: nowrap;
        }
        .select-sort {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          color: #ffffff;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          outline: none;
        }
        .select-sort:focus {
          border-color: #DC143C;
        }

        /* ── Pills ── */
        .pills-container {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .pill {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          color: #888888;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .pill:hover {
          color: #ffffff;
          border-color: #444444;
        }
        .pill.active {
          background: #DC143C;
          color: #ffffff;
          border-color: #DC143C;
          font-weight: 600;
        }

        /* ── Client List Rows ── */
        .clients-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .client-row {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          gap: 16px;
          cursor: pointer;
          transition: border-color 0.2s, background 0.15s;
          flex-wrap: wrap;
        }
        .client-row:hover {
          border-color: #444444;
          background: #202020;
        }
        .client-row.selected {
          border-color: #DC143C;
          background: #221518;
        }

        .avatar-circle {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #262626;
          border: 2px solid #555;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          color: #ffffff;
          flex-shrink: 0;
        }

        .client-main-info {
          flex: 2;
          min-width: 250px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .client-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .client-name {
          font-size: 16px;
          font-weight: 600;
          color: #ffffff;
        }

        .badge-recurrente {
          font-size: 10px;
          font-weight: 700;
          color: #4ade80;
          background: rgba(74, 222, 128, 0.15);
          border: 1px solid rgba(74, 222, 128, 0.3);
          padding: 2px 8px;
          border-radius: 12px;
          text-transform: uppercase;
        }
        .badge-tier {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          border: 1px solid;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .contact-snippets {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }
        .contact-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #262626;
          border: 1px solid #333333;
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 12px;
          color: #cccccc;
          transition: background 0.15s, border-color 0.15s;
        }
        .contact-tag:hover {
          background: #333333;
          border-color: #555555;
          color: #ffffff;
        }
        .contact-tag.missing {
          opacity: 0.5;
          background: transparent;
          border-style: dashed;
        }
        .tag-icon { font-size: 11px; }
        .tag-val { font-family: var(--font-inter), monospace; }
        .tag-val.truncate {
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .copy-btn-mini {
          background: none;
          border: none;
          font-size: 10px;
          cursor: pointer;
          opacity: 0.7;
          padding: 0 2px;
        }
        .copy-btn-mini:hover { opacity: 1; }

        .client-metrics-col {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          min-width: 120px;
        }
        .metrics-total {
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
        }
        .metrics-orders {
          font-size: 12px;
          color: #888888;
        }
        .metrics-date {
          font-size: 11px;
          color: #666666;
          margin-top: 2px;
        }

        .client-actions-col {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn-booking-shortcut {
          background: #DC143C;
          color: #ffffff;
          border: none;
          padding: 7px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .btn-booking-shortcut:hover {
          background: #b91032;
        }
        .btn-wa-shortcut {
          background: #25D366;
          color: #ffffff;
          text-decoration: none;
          padding: 7px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          transition: opacity 0.15s;
          white-space: nowrap;
        }
        .btn-wa-shortcut:hover {
          opacity: 0.9;
        }
        .btn-profile-open {
          background: transparent;
          color: #888888;
          border: 1px solid #333333;
          padding: 7px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .btn-profile-open:hover {
          color: #ffffff;
          border-color: #666666;
        }

        /* ── SLIDE-OVER DRAWER ── */
        .drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          z-index: 999;
          display: flex;
          justify-content: flex-end;
          animation: fadeIn 0.2s ease-out;
        }
        .drawer-content {
          width: 100%;
          max-width: 580px;
          background: #161616;
          border-left: 1px solid #2a2a2a;
          height: 100vh;
          overflow-y: auto;
          padding: 28px 24px 60px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: slideLeft 0.25s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }

        .drawer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 12px;
          border-bottom: 1px solid #2a2a2a;
        }
        .drawer-eyebrow {
          font-size: 10px;
          color: #DC143C;
          letter-spacing: 0.15em;
          font-weight: 700;
        }
        .drawer-close-btn {
          background: #262626;
          border: 1px solid #333333;
          color: #aaaaaa;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .drawer-close-btn:hover {
          color: #ffffff;
          background: #333333;
        }

        /* Profile Hero */
        .profile-hero {
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .profile-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: #222;
          border: 3px solid #555;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: bold;
          flex-shrink: 0;
        }
        .profile-identity {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }
        .hero-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .profile-name {
          font-size: 22px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.1;
        }
        .btn-edit-text {
          background: none;
          border: none;
          font-size: 12px;
          cursor: pointer;
          opacity: 0.6;
        }
        .btn-edit-text:hover { opacity: 1; }
        .profile-badges {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .badge-segment {
          font-size: 10px;
          font-weight: 700;
          color: #888888;
          background: #222222;
          border: 1px solid #333333;
          padding: 2px 8px;
          border-radius: 12px;
          text-transform: uppercase;
        }

        /* Booking CTA Large */
        .booking-cta-box {
          background: #221418;
          border: 1px solid #DC143C;
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .booking-cta-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .booking-cta-info strong {
          color: #ffffff;
          font-size: 14px;
        }
        .booking-cta-info span {
          color: #aaaaaa;
          font-size: 12px;
        }
        .btn-copy-dossier-large {
          background: #DC143C;
          color: #ffffff;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-copy-dossier-large:hover {
          background: #b91032;
        }

        /* Action Buttons Row */
        .action-button-row {
          display: flex;
          gap: 8px;
        }
        .btn-action-channel {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          color: #ffffff;
          transition: opacity 0.15s;
        }
        .btn-action-channel.whatsapp { background: #25D366; }
        .btn-action-channel.email { background: #3b82f6; }
        .btn-action-channel.call { background: #374151; }
        .btn-action-channel:hover { opacity: 0.9; }

        /* Section Cards */
        .section-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          padding: 18px;
        }
        .section-title {
          font-size: 12px;
          font-weight: 700;
          color: #aaaaaa;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 14px;
        }
        .section-header-flex {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .section-header-flex .section-title { margin-bottom: 0; }
        .section-tip { font-size: 11px; color: #666666; }
        .orders-link { font-size: 12px; color: #DC143C; text-decoration: none; font-weight: 600; }
        .orders-link:hover { text-decoration: underline; }

        /* Fields Grid */
        .fields-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .field-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          background: #202020;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 10px 12px;
        }
        .field-label {
          font-size: 10px;
          color: #888888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }
        .field-content-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .field-value {
          font-size: 14px;
          color: #ffffff;
          word-break: break-word;
        }
        .field-value.phone-val {
          font-family: var(--font-inter), monospace;
          font-weight: 600;
        }
        .field-value.placeholder {
          color: #666666;
          font-style: italic;
        }
        .field-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        .btn-field-copy {
          background: #2b2b2b;
          border: 1px solid #3a3a3a;
          color: #fff;
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 5px;
          cursor: pointer;
        }
        .btn-field-copy:hover { background: #383838; }
        .btn-field-edit {
          background: none;
          border: none;
          font-size: 12px;
          cursor: pointer;
          opacity: 0.7;
        }
        .btn-field-edit:hover { opacity: 1; }

        .input-date {
          background: #2b2b2b;
          border: 1px solid #3a3a3a;
          color: #ffffff;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 13px;
          color-scheme: dark;
          outline: none;
          max-width: 180px;
        }

        /* Inline Edit Box */
        .inline-edit-box {
          display: flex;
          gap: 6px;
          align-items: center;
          margin-top: 4px;
          width: 100%;
        }
        .input-sleek {
          background: #111111;
          border: 1px solid #444444;
          color: #ffffff;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 13px;
          flex: 1;
          outline: none;
        }
        .input-sleek:focus { border-color: #DC143C; }
        .textarea-sm { min-height: 60px; resize: vertical; }
        .textarea-notes {
          width: 100%;
          min-height: 80px;
          resize: vertical;
          line-height: 1.5;
        }
        .edit-btn-row { display: flex; gap: 6px; margin-top: 6px; }

        .btn-primary-sm {
          background: #DC143C;
          border: none;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-ghost-sm {
          background: transparent;
          border: 1px solid #3a3a3a;
          color: #888;
          font-size: 12px;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
        }

        /* VIP Box */
        .vip-box {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .vip-metric-row {
          display: flex;
          justify-content: space-between;
          background: #202020;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 12px;
          gap: 10px;
          flex-wrap: wrap;
        }
        .vip-metric-title {
          font-size: 11px;
          color: #888888;
          display: block;
          margin-bottom: 2px;
        }
        .vip-metric-val {
          font-size: 15px;
          color: #ffffff;
        }
        .vip-progress-block {
          background: #202020;
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .vip-progress-info {
          font-size: 12px;
          color: #cccccc;
        }
        .progress-bar-track {
          height: 6px;
          background: #333333;
          border-radius: 3px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }
        .vip-max-achieved {
          font-size: 13px;
          font-weight: 600;
          color: #fbbf24;
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.2);
          border-radius: 8px;
          padding: 10px;
          text-align: center;
        }

        /* Order History */
        .orders-table {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .order-history-row {
          background: #202020;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .order-history-row.cancelled {
          opacity: 0.5;
        }
        .order-row-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .order-row-num {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .order-row-num strong { font-size: 13px; color: #ffffff; }
        .order-row-date { font-size: 12px; color: #888888; }
        .status-pill {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 8px;
          border-radius: 10px;
          border: 1px solid #444;
          background: #262626;
          color: #ccc;
        }
        .status-pill.confirmed { color: #60a5fa; border-color: #60a5fa; background: rgba(96, 165, 250, 0.1); }
        .status-pill.delivered { color: #4ade80; border-color: #4ade80; background: rgba(74, 222, 128, 0.1); }
        .status-pill.cancelled { color: #f87171; border-color: #f87171; background: rgba(248, 113, 113, 0.1); }

        .order-items-snippet {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .item-pill {
          font-size: 11px;
          background: #2b2b2b;
          border: 1px solid #383838;
          padding: 2px 6px;
          border-radius: 4px;
          color: #cccccc;
        }
        .order-row-total {
          font-size: 12px;
          color: #aaaaaa;
          text-align: right;
        }
        .order-row-total strong { color: #ffffff; font-size: 14px; }
        .empty-orders {
          color: #666666;
          font-size: 13px;
          text-align: center;
          padding: 20px 0;
        }

        /* Danger Zone */
        .danger-zone {
          padding-top: 10px;
          border-top: 1px solid #2a2a2a;
        }
        .btn-danger-wipe {
          width: 100%;
          background: transparent;
          border: 1px solid #ef4444;
          color: #ef4444;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-danger-wipe:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        /* Common buttons & states */
        .btn-outline {
          background: transparent;
          border: 1px solid #333333;
          color: #ffffff;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
        }
        .btn-outline:hover { border-color: #666666; }
        .state-box {
          text-align: center;
          padding: 60px 20px;
          color: #888888;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid #333;
          border-top-color: #DC143C;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .client-row { flex-direction: column; align-items: flex-start; }
          .client-metrics-col { align-items: flex-start; }
          .client-actions-col { width: 100%; justify-content: flex-start; flex-wrap: wrap; }
          .drawer-content { max-width: 100%; padding: 20px 16px 40px; }
        }
      `}</style>
    </div>
  )
}
