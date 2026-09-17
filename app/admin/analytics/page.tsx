'use client'
// app/admin/analytics/page.tsx
// ─────────────────────────────────────────────────────────────
// DISTRITO PIPA · ANALYTICS & INTELIGENCIA COMERCIAL
// Aligned with Brand Board (#DC143C, Bebas Neue, Inter)
// Integrated with Director Comercial & CMO perspectives
// Rigorous distinction between Converted Clients vs Incomplete Leads
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/hooks/useAdmin'

interface OrderItem {
  name: string
  qty: number
  unit_price: number
  color?: string
  bundle_qty?: number
  bundle_price?: number
}

interface Order {
  id: string
  order_number: string
  status: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  items: OrderItem[]
  subtotal_mxn: number
  delivery_fee: number
  total_mxn: number
  anticipo_mxn: number
  anticipo_paid: boolean
  delivery_mode: string
  delivery_zone?: string
  is_night?: boolean
  payment_mode?: string
  delivery_address?: string
  created_at: string
}

interface DayStat { day: string; orders: number; revenue: number }
interface ProductStat { name: string; total_ordered: number; revenue: number }
interface SearchStat { query: string; count: number; zero_results: boolean }
interface KeywordStat {
  query: string; page: string; clicks: number;
  impressions: number; ctr: number; position: number
}
interface VisitorData {
  pageviews: number; uniqueVisitors: number;
  topPages: { path: string; views: number }[];
  topReferrers: { source: string; count: number }[];
  devices: { type: string; count: number }[];
}

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<7 | 30 | 90 | 'all'>('all')
  const [activeTab, setActiveTab] = useState<'all' | 'commercial' | 'cmo' | 'seo'>('all')
  const [loading, setLoading] = useState(true)

  // Orders repository
  const [allOrders, setAllOrders] = useState<Order[]>([])

  // PostHog visitor analytics
  const [visitors, setVisitors] = useState<VisitorData | null>(null)
  const [visitorsLoading, setVisitorsLoading] = useState(true)

  // Site search intelligence
  const [topSearches, setTopSearches] = useState<SearchStat[]>([])
  const [zeroResultSearches, setZeroResults] = useState<SearchStat[]>([])
  const [searchesLoading, setSearchesLoading] = useState(true)

  // SEO keywords (GSC)
  const [topKeywords, setTopKeywords] = useState<KeywordStat[]>([])
  const [strikingDistance, setStrikingDistance] = useState<KeywordStat[]>([])
  const [longTailKeywords, setLongTail] = useState<KeywordStat[]>([])
  const [blogKeywords, setBlogKeywords] = useState<KeywordStat[]>([])
  const [keywordsLoading, setKeywordsLoading] = useState(true)

  useEffect(() => {
    loadAllData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadAuxiliaryData()
  }, [range]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAllData() {
    setLoading(true)
    await Promise.all([
      loadOrders(),
      loadAuxiliaryData(),
    ])
    setLoading(false)
  }

  async function loadOrders() {
    try {
      const res = await adminFetch('/api/admin/orders')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.orders)) {
          setAllOrders(data.orders)
          return
        }
      }
    } catch (err) {
      console.warn('Could not fetch /api/admin/orders:', err)
    }

    // Fallback to local storage if running in mock/demo mode
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dp_mock_orders')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) setAllOrders(parsed)
        } catch {}
      }
    }
  }

  async function loadAuxiliaryData() {
    setVisitorsLoading(true)
    setSearchesLoading(true)
    setKeywordsLoading(true)

    const rangeParam = range === 'all' ? '90' : range.toString()

    // 1. Visitors (PostHog)
    try {
      const res = await adminFetch(`/api/admin/analytics/visitors?days=${rangeParam}`)
      if (res.ok) {
        const data = await res.json()
        setVisitors(data)
      } else {
        setVisitors(null)
      }
    } catch {
      setVisitors(null)
    } finally {
      setVisitorsLoading(false)
    }

    // 2. Searches
    try {
      const res = await adminFetch(`/api/admin/analytics/searches?days=${range}`)
      if (res.ok) {
        const data = await res.json()
        setTopSearches(data.topSearches || [])
        setZeroResults(data.zeroResultSearches || [])
      }
    } catch {
      // Fallback
    } finally {
      setSearchesLoading(false)
    }

    // 3. Keywords (GSC)
    try {
      const res = await adminFetch(`/api/admin/analytics/keywords?days=${rangeParam}`)
      if (res.ok) {
        const data = await res.json()
        setTopKeywords(data.topKeywords || [])
        setStrikingDistance(data.strikingDistance || [])
        setLongTail(data.longTailKeywords || [])
        setBlogKeywords(data.blogKeywords || [])
      }
    } catch {
      // Fallback
    } finally {
      setKeywordsLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 1. PIPELINE BREAKDOWN (TOTAL INICIADOS VS CONVERTIDOS)
  // ─────────────────────────────────────────────────────────────
  const pipeline = useMemo(() => {
    const totalInitiated = allOrders.length
    const delivered = allOrders.filter(o => o.status === 'delivered')
    const pending = allOrders.filter(o => o.status === 'pending' || o.status === 'new' || o.status === 'confirmed' || o.status === 'preparing' || o.status === 'ready')
    const canceled = allOrders.filter(o => o.status === 'cancelled' || o.status === 'canceled')

    const deliveredRevenue = delivered.reduce((s, o) => s + (o.total_mxn || 0), 0)
    const pendingRevenue = pending.reduce((s, o) => s + (o.total_mxn || 0), 0)

    const conversionRate = totalInitiated > 0 ? Math.round((delivered.length / totalInitiated) * 100) : 0

    return {
      totalInitiated,
      deliveredOrders: delivered,
      pendingOrders: pending,
      canceledOrders: canceled,
      deliveredRevenue,
      pendingRevenue,
      conversionRate,
    }
  }, [allOrders])

  // ─────────────────────────────────────────────────────────────
  // 2. CLIENTES REALES (CONVERTIDOS): EXCLUSIVAMENTE ENTREGADOS
  // Un lead o pedido cancelado/abandonado NO es un cliente.
  // ─────────────────────────────────────────────────────────────
  const convertedClientsMetrics = useMemo(() => {
    // Agrupamos ÚNICAMENTE los pedidos entregados/cobrados
    const clientsMap: Record<string, { phone: string; name: string; deliveredCount: number; totalSpent: number }> = {}

    pipeline.deliveredOrders.forEach(o => {
      const rawPhone = o.customer_phone || ''
      const cleanPhone = rawPhone.replace(/\D/g, '') || rawPhone || o.customer_name || 'Sin-Teléfono'
      if (!cleanPhone) return

      if (!clientsMap[cleanPhone]) {
        clientsMap[cleanPhone] = {
          phone: rawPhone,
          name: o.customer_name || 'Cliente',
          deliveredCount: 0,
          totalSpent: 0,
        }
      }

      clientsMap[cleanPhone].deliveredCount += 1
      clientsMap[cleanPhone].totalSpent += (o.total_mxn || 0)
    })

    const realClientsList = Object.values(clientsMap)
    const convertedCount = realClientsList.length

    // Meta 2: Clientes con 2 o más entregas reales
    const recurringCount = realClientsList.filter(c => c.deliveredCount >= 2).length

    // Meta 3: Clientes con compras de mayoreo entregadas ($1,500+ MXN)
    const wholesaleCount = realClientsList.filter(c => c.totalSpent >= 1500 || c.deliveredCount >= 5).length

    // Tiers de lealtad (SOLO CLIENTES CONVERTIDOS)
    let gold = 0
    let silver = 0
    let bronze = 0

    realClientsList.forEach(c => {
      if (c.totalSpent >= 1500 || c.deliveredCount >= 5) {
        gold++
      } else if (c.totalSpent >= 600 || c.deliveredCount >= 2) {
        silver++
      } else {
        bronze++
      }
    })

    // Conteo total de contactos / leads que han iniciado checkout (convertidos + pendientes)
    const allContactsMap: Record<string, boolean> = {}
    allOrders.forEach(o => {
      const p = (o.customer_phone || '').replace(/\D/g, '') || o.customer_name
      if (p) allContactsMap[p] = true
    })
    const totalLeadsCount = Object.keys(allContactsMap).length

    return {
      convertedCount,
      recurringCount,
      wholesaleCount,
      totalLeadsCount,
      gold,
      silver,
      bronze,
    }
  }, [pipeline.deliveredOrders, allOrders])

  // ─────────────────────────────────────────────────────────────
  // 3. PEDIDOS FILTRADOS POR EL SELECTOR DE FECHA (FINANZAS)
  // ─────────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    if (range === 'all') return allOrders
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - range)
    return allOrders.filter(o => new Date(o.created_at) >= cutoff)
  }, [allOrders, range])

  // ─────────────────────────────────────────────────────────────
  // 4. FINANZAS Y LOGÍSTICA REAL DE LOS PEDIDOS FILTRADOS
  // ─────────────────────────────────────────────────────────────
  const financialData = useMemo(() => {
    const list = filteredOrders
    const delivered = list.filter(o => o.status === 'delivered')
    const pending = list.filter(o => o.status === 'pending' || o.status === 'new' || o.status === 'confirmed' || o.status === 'preparing' || o.status === 'ready')

    const delRev = delivered.reduce((s, o) => s + (o.total_mxn || 0), 0)
    const pendRev = pending.reduce((s, o) => s + (o.total_mxn || 0), 0)

    // COGS de los pedidos entregados
    let cogsSum = 0
    delivered.forEach(o => {
      let orderCOGS = 0
      if (Array.isArray(o.items) && o.items.length > 0) {
        o.items.forEach(item => {
          const name = (item.name || '').toLowerCase()
          const qty = item.qty || 1
          if (name.includes('mini')) {
            orderCOGS += 4 * qty
          } else if (name.includes('sencilla') || name.includes('simple')) {
            orderCOGS += 6 * qty
          } else if (name.includes('reforzada') || name.includes('heavy') || name.includes('gruesa')) {
            orderCOGS += 9 * qty
          } else if (name.includes('soplete') || name.includes('torch')) {
            orderCOGS += 35 * qty
          } else if (name.includes('grinder')) {
            orderCOGS += 25 * qty
          } else if (name.includes('kit')) {
            orderCOGS += 30 * qty
          } else {
            const itemPrice = item.bundle_price ?? ((item.unit_price || 0) * qty)
            orderCOGS += (itemPrice || 50) * 0.22
          }
        })
      } else {
        orderCOGS = (o.total_mxn || 0) * 0.22
      }
      cogsSum += orderCOGS
    })

    const roundedCOGS = Math.round(cogsSum)
    const grossMargin = Math.max(delRev - roundedCOGS, 0)
    const marginPct = delRev > 0 ? Math.round((grossMargin / delRev) * 100) : 0
    const avgTicket = delivered.length > 0 ? Math.round(delRev / delivered.length) : 0

    // Cobranza contra-entrega
    const cod = delivered.reduce((s, o) => {
      const mode = (o.payment_mode || '').toLowerCase()
      if (mode === 'cash' || mode === 'contra_entrega' || mode === 'pickup_cash' || !o.payment_mode) {
        return s + (o.total_mxn || 0)
      }
      return s
    }, 0)

    // Efectividad de anticipo
    const withAnticipo = list.filter(o => (o.anticipo_mxn || 0) > 0 || o.anticipo_paid !== undefined)
    const paidAnticipo = withAnticipo.filter(o => o.anticipo_paid === true).length
    const anticipoEffectiveness = withAnticipo.length > 0
      ? Math.round((paidAnticipo / withAnticipo.length) * 100)
      : (delivered.length > 0 ? 100 : 0)

    // Logística en pedidos entregados (y desglose general de iniciados)
    let deliveredPickups = 0
    let deliveredDeliveries = 0
    let deliveredNight = 0
    let deliveredDay = 0

    delivered.forEach(o => {
      const mode = (o.delivery_mode || '').toLowerCase()
      if (mode === 'pickup' || mode === 'punto_medio') {
        deliveredPickups++
      } else {
        deliveredDeliveries++
      }
      if (o.is_night === true) {
        deliveredNight++
      } else {
        deliveredDay++
      }
    })

    // Totales en todos los iniciados del periodo
    let totalPickups = 0
    let totalDeliveries = 0
    let totalNight = 0
    let totalDay = 0

    list.forEach(o => {
      const mode = (o.delivery_mode || '').toLowerCase()
      if (mode === 'pickup' || mode === 'punto_medio') totalPickups++
      else totalDeliveries++

      if (o.is_night === true) totalNight++
      else totalDay++
    })

    // Gráfica de ingresos por día
    const byDay: Record<string, DayStat> = {}
    delivered.forEach(o => {
      const dayKey = (o.created_at || '').slice(0, 10)
      if (!dayKey) return
      if (!byDay[dayKey]) byDay[dayKey] = { day: dayKey, orders: 0, revenue: 0 }
      byDay[dayKey].orders++
      byDay[dayKey].revenue += (o.total_mxn || 0)
    })
    const dailyStats = Object.values(byDay)
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-14)

    // Top productos vendidos (solo en pedidos entregados)
    const productMap: Record<string, ProductStat> = {}
    delivered.forEach(o => {
      if (!Array.isArray(o.items)) return
      o.items.forEach(item => {
        const key = item.name || 'Producto General'
        if (!productMap[key]) productMap[key] = { name: key, total_ordered: 0, revenue: 0 }
        productMap[key].total_ordered += item.qty || 1
        productMap[key].revenue += item.bundle_price ?? ((item.unit_price || 0) * (item.qty || 1))
      })
    })
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.total_ordered - a.total_ordered)
      .slice(0, 8)

    return {
      delRev,
      pendRev,
      roundedCOGS,
      grossMargin,
      marginPct,
      avgTicket,
      cod,
      anticipoEffectiveness,
      deliveredPickups,
      deliveredDeliveries,
      deliveredNight,
      deliveredDay,
      totalPickups,
      totalDeliveries,
      totalNight,
      totalDay,
      dailyStats,
      topProducts,
      recentOrders: list.slice(0, 6),
      deliveredOrdersCount: delivered.length,
      pendingOrdersCount: pending.length,
      totalOrdersCount: list.length,
    }
  }, [filteredOrders])

  const maxRevenue = useMemo(() => Math.max(...financialData.dailyStats.map(d => d.revenue), 1), [financialData.dailyStats])
  const maxProd = useMemo(() => Math.max(...financialData.topProducts.map(p => p.total_ordered), 1), [financialData.topProducts])

  // Conversion funnel
  const funnelVisitors = visitors?.uniqueVisitors || Math.max(convertedClientsMetrics.totalLeadsCount * 12, 60)
  const funnelCatalog = (visitors?.topPages || []).find(p => p.path === '/catalogo')?.views || Math.max(Math.round(funnelVisitors * 0.7), pipeline.totalInitiated)
  const funnelOrders = pipeline.totalInitiated
  const funnelDelivered = pipeline.deliveredOrders.length

  return (
    <div className="analytics-page">
      {/* ────────────────────────────────────────────────────── */}
      {/* HEADER: Brand Board Aligned                            */}
      {/* ────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div className="header-brand-wrap">
          <div className="brand-eyebrow">
            <span className="live-dot" />
            DISTRITO PIPA · CANCÚN, Q. ROO · CONTROL ESTRATÉGICO
          </div>
          <h1 className="brand-title">ANALYTICS & INTELIGENCIA</h1>
          <p className="brand-subtitle">
            Auditoría rigurosa: Conversión de Clientes Reales, Facturación Entregada y Logística Cancún.
          </p>
        </div>

        <div className="header-actions">
          {/* Range tabs */}
          <div className="range-tabs">
            {(['all', 90, 30, 7] as const).map(r => (
              <button
                key={r}
                className={`rtab ${range === r ? 'active' : ''}`}
                onClick={() => setRange(r)}
              >
                {r === 'all' ? 'Todo (Histórico)' : `${r} días`}
              </button>
            ))}
          </div>

          {/* Quick shortcuts */}
          <div className="quick-links">
            <Link href="/admin/orders" className="q-link">🚚 Pedidos</Link>
            <Link href="/admin/clients" className="q-link">👥 Clientes</Link>
            <Link href="/admin/products" className="q-link">📦 Inventario</Link>
            <Link href="/admin/blog" className="q-link">📝 Blog</Link>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────── */}
      {/* TABS NAVIGATION                                        */}
      {/* ────────────────────────────────────────────────────── */}
      <nav className="nav-tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          📊 Visión Integral (Todos)
        </button>
        <button
          className={`tab-btn ${activeTab === 'commercial' ? 'active' : ''}`}
          onClick={() => setActiveTab('commercial')}
        >
          👔 Dirección Comercial & Finanzas
        </button>
        <button
          className={`tab-btn ${activeTab === 'cmo' ? 'active' : ''}`}
          onClick={() => setActiveTab('cmo')}
        >
          🚀 CMO & Embudo de Conversión
        </button>
        <button
          className={`tab-btn ${activeTab === 'seo' ? 'active' : ''}`}
          onClick={() => setActiveTab('seo')}
        >
          🎯 SEO & Oportunidades
        </button>
      </nav>

      <main className="analytics-body">
        {/* ══════════════════════════════════════════════════════ */}
        {/* PIPELINE AUDIT BANNER: LEADS VS REAL CLIENTS         */}
        {/* ══════════════════════════════════════════════════════ */}
        <section className="pipeline-audit-bar">
          <div className="audit-item">
            <span className="audit-lbl">Pedidos Iniciados en Tienda</span>
            <span className="audit-val">{pipeline.totalInitiated}</span>
            <span className="audit-sub">Carritos/órdenes creadas</span>
          </div>
          <div className="audit-divider">➔</div>
          <div className="audit-item highlight-green">
            <span className="audit-lbl">Clientes Convertidos (Entregados)</span>
            <span className="audit-val green">{pipeline.deliveredOrders.length}</span>
            <span className="audit-sub">${pipeline.deliveredRevenue.toLocaleString('es-MX')} cobrados</span>
          </div>
          <div className="audit-divider">|</div>
          <div className="audit-item highlight-orange">
            <span className="audit-lbl">En Cartera / Por Concretar</span>
            <span className="audit-val gold">{pipeline.pendingOrders.length}</span>
            <span className="audit-sub">${pipeline.pendingRevenue.toLocaleString('es-MX')} esperando entrega</span>
          </div>
          <div className="audit-divider">|</div>
          <div className="audit-item">
            <span className="audit-lbl">Cancelados / Descartados</span>
            <span className="audit-val red">{pipeline.canceledOrders.length}</span>
            <span className="audit-sub">Sin depósito o liberados</span>
          </div>
          <div className="audit-item rate-box">
            <span className="audit-lbl">Tasa de Conversión</span>
            <span className="audit-val rate">{pipeline.conversionRate}%</span>
            <span className="audit-sub">Iniciado ➔ Concretado</span>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════ */}
        {/* SECTION: GROWTH ROADMAP (CLIENTES REALES CONVERTIDOS) */}
        {/* ══════════════════════════════════════════════════════ */}
        {(activeTab === 'all' || activeTab === 'commercial') && (
          <section className="dashboard-section">
            <div className="section-header">
              <div className="section-badge red">CRITERIO COMERCIAL ESTRICTO</div>
              <h2 className="section-heading">Roadmap Cancún 2026: Clientes Concretados</h2>
              <p className="section-desc">
                Solo se contabilizan como <strong>Clientes</strong> aquellas personas con pedidos entregados y cobrados. Los carritos o pedidos sin pagar son prospectos, no clientes.
              </p>
            </div>

            <div className="roadmap-grid">
              {/* Meta 1 */}
              <div className="roadmap-card">
                <div className="rm-badge">META 1 · BASE COMERCIAL</div>
                <div className="rm-title">100 Clientes Base</div>
                <div className="rm-desc">Personas con al menos 1 compra entregada y cobrada con éxito en Cancún.</div>
                <div className="rm-progress-wrap">
                  <div className="rm-numbers">
                    <span className="rm-current">{convertedClientsMetrics.convertedCount}</span>
                    <span className="rm-target">/ 100 objetivo</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill red"
                      style={{ width: `${Math.min((convertedClientsMetrics.convertedCount / 100) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="rm-status">
                  {convertedClientsMetrics.convertedCount >= 100
                    ? '🎉 ¡Meta alcanzada!'
                    : `Faltan ${100 - convertedClientsMetrics.convertedCount} clientes reales para completar`}
                </div>
                <div className="rm-footnote">
                  ({convertedClientsMetrics.totalLeadsCount} prospectos han iniciado contacto en total)
                </div>
              </div>

              {/* Meta 2 */}
              <div className="roadmap-card">
                <div className="rm-badge">META 2 · RETENCIÓN & LTV</div>
                <div className="rm-title">20 Compradores Recurrentes</div>
                <div className="rm-desc">Clientes que ya recibieron y pagaron 2 o más pedidos completados.</div>
                <div className="rm-progress-wrap">
                  <div className="rm-numbers">
                    <span className="rm-current">{convertedClientsMetrics.recurringCount}</span>
                    <span className="rm-target">/ 20 objetivo</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill gold"
                      style={{ width: `${Math.min((convertedClientsMetrics.recurringCount / 20) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="rm-status">
                  {convertedClientsMetrics.recurringCount >= 20
                    ? '🎉 ¡Meta alcanzada!'
                    : `Faltan ${20 - convertedClientsMetrics.recurringCount} clientes con recompra verificada`}
                </div>
              </div>

              {/* Meta 3 */}
              <div className="roadmap-card">
                <div className="rm-badge">META 3 · MAYOREO CANCÚN</div>
                <div className="rm-title">5 Revendedores Activos</div>
                <div className="rm-desc">Compradores mayoristas con compras concretadas de $1,500+ MXN o 5+ pedidos.</div>
                <div className="rm-progress-wrap">
                  <div className="rm-numbers">
                    <span className="rm-current">{convertedClientsMetrics.wholesaleCount}</span>
                    <span className="rm-target">/ 5 objetivo</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill green"
                      style={{ width: `${Math.min((convertedClientsMetrics.wholesaleCount / 5) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="rm-status">
                  {convertedClientsMetrics.wholesaleCount >= 5
                    ? '🎉 ¡Meta alcanzada!'
                    : `Faltan ${5 - convertedClientsMetrics.wholesaleCount} clientes mayoristas entregados`}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SECTION: FINANCIAL & LOGISTICS AUDIT                 */}
        {/* ══════════════════════════════════════════════════════ */}
        {(activeTab === 'all' || activeTab === 'commercial') && (
          <section className="dashboard-section">
            <div className="section-header">
              <div className="section-badge red">MONITOREO FINANCIERO Y OPERATIVO REAL</div>
              <h2 className="section-heading">
                Rendimiento Comercial {range === 'all' ? '(Histórico Completo)' : `(Últimos ${range} días)`}
              </h2>
              <p className="section-desc">
                Cálculo de ingresos cobrados, margen comercial real y desglose de envíos con tarifas oficiales de checkout.
              </p>
            </div>

            {loading ? (
              <div className="loading-grid">
                {[...Array(6)].map((_, i) => <div key={i} className="loading-card" />)}
              </div>
            ) : (
              <>
                <div className="kpi-grid">
                  {/* Revenue */}
                  <div className="kpi-card accent-border">
                    <div className="kpi-label">Facturación Real Cobrada</div>
                    <div className="kpi-val highlight">${financialData.delRev.toLocaleString('es-MX')}</div>
                    <div className="kpi-sub">
                      {financialData.deliveredOrdersCount > 0
                        ? `${financialData.deliveredOrdersCount} pedidos completados`
                        : `Sin entregas concretadas aún ($${financialData.pendRev.toLocaleString('es-MX')} en proceso)`}
                    </div>
                  </div>

                  {/* COGS */}
                  <div className="kpi-card">
                    <div className="kpi-label">Costo Mercancía (COGS)</div>
                    <div className="kpi-val muted">${financialData.roundedCOGS.toLocaleString('es-MX')}</div>
                    <div className="kpi-sub">Basado en costo unitario de pedidos entregados</div>
                  </div>

                  {/* Margin */}
                  <div className="kpi-card green-border">
                    <div className="kpi-label">Margen Bruto Comercial</div>
                    <div className="kpi-val green">
                      ${financialData.grossMargin.toLocaleString('es-MX')}
                      <span className="kpi-percent">({financialData.marginPct}%)</span>
                    </div>
                    <div className="kpi-sub">Utilidad sobre pedidos entregados</div>
                  </div>

                  {/* COD Cash */}
                  <div className="kpi-card">
                    <div className="kpi-label">Efectivo Cobrado al Entregar</div>
                    <div className="kpi-val">${financialData.cod.toLocaleString('es-MX')}</div>
                    <div className="kpi-sub">Recaudado físicamente por repartidor</div>
                  </div>

                  {/* Anticipo */}
                  <div className="kpi-card">
                    <div className="kpi-label">Efectividad Anticipo $50</div>
                    <div className="kpi-val gold">{financialData.anticipoEffectiveness}%</div>
                    <div className="kpi-sub">
                      {financialData.pendingOrdersCount > 0
                        ? `${financialData.pendingOrdersCount} pedidos esperando confirmación`
                        : 'Filtro anti-cancelación'}
                    </div>
                  </div>

                  {/* Ticket Promedio */}
                  <div className="kpi-card">
                    <div className="kpi-label">Ticket Promedio Entregado</div>
                    <div className="kpi-val">${financialData.avgTicket.toLocaleString('es-MX')}</div>
                    <div className="kpi-sub">Promedio por cliente completado</div>
                  </div>
                </div>

                {/* Operations & Logistics with Official Checkout Pricing */}
                <div className="operations-split-grid">
                  <div className="op-card">
                    <div className="op-card-header">
                      <span className="op-icon">📍</span>
                      <div>
                        <div className="op-title">Modalidad de Entrega (Cancún)</div>
                        <div className="op-subtitle">Tarifas configuradas en Checkout</div>
                      </div>
                    </div>

                    <div className="op-metrics-row">
                      <div className="op-metric-block">
                        <div className="op-val">{financialData.deliveredPickups}</div>
                        <div className="op-lbl">Pickups Región 96</div>
                        <div className="op-detail">Soriana / Coppel Nichupté · <strong>$0 MXN</strong></div>
                        <div className="op-tiny">({financialData.totalPickups} iniciados en total)</div>
                      </div>
                      <div className="op-metric-block">
                        <div className="op-val">{financialData.deliveredDeliveries}</div>
                        <div className="op-lbl">Envíos a Domicilio</div>
                        <div className="op-detail">Zona 1: <strong>$50 MXN</strong> · Zona 2: <strong>$80 MXN</strong></div>
                        <div className="op-tiny">({financialData.totalDeliveries} iniciados en total)</div>
                      </div>
                    </div>

                    <div className="progress-bar-bg dual">
                      <div
                        className="progress-bar-fill red"
                        style={{
                          width: `${financialData.deliveredOrdersCount > 0
                            ? (financialData.deliveredPickups / financialData.deliveredOrdersCount) * 100
                            : (financialData.totalPickups / Math.max(financialData.totalOrdersCount, 1)) * 100}%`
                        }}
                      />
                      <div
                        className="progress-bar-fill blue"
                        style={{
                          width: `${financialData.deliveredOrdersCount > 0
                            ? (financialData.deliveredDeliveries / financialData.deliveredOrdersCount) * 100
                            : (financialData.totalDeliveries / Math.max(financialData.totalOrdersCount, 1)) * 100}%`
                        }}
                      />
                    </div>
                    <div className="op-bar-legend">
                      <span>🔴 Pickups concretados: {financialData.deliveredPickups}</span>
                      <span>🔵 Domicilios concretados: {financialData.deliveredDeliveries}</span>
                    </div>
                  </div>

                  <div className="op-card">
                    <div className="op-card-header">
                      <span className="op-icon">🌙</span>
                      <div>
                        <div className="op-title">Franja Horaria de Entrega</div>
                        <div className="op-subtitle">Diurno vs Nocturno Express</div>
                      </div>
                    </div>

                    <div className="op-metrics-row">
                      <div className="op-metric-block">
                        <div className="op-val">{financialData.deliveredDay}</div>
                        <div className="op-lbl">Horario Diurno</div>
                        <div className="op-detail">Antes de las 8:00 PM · Tarifa regular</div>
                        <div className="op-tiny">({financialData.totalDay} iniciados en total)</div>
                      </div>
                      <div className="op-metric-block">
                        <div className="op-val night-val">{financialData.deliveredNight}</div>
                        <div className="op-lbl">Horario Nocturno</div>
                        <div className="op-detail">8:00 PM – 2:00 AM · <strong>+ $30 MXN recargo</strong></div>
                        <div className="op-tiny">({financialData.totalNight} iniciados en total)</div>
                      </div>
                    </div>

                    <div className="progress-bar-bg dual">
                      <div
                        className="progress-bar-fill green"
                        style={{
                          width: `${financialData.deliveredOrdersCount > 0
                            ? (financialData.deliveredDay / financialData.deliveredOrdersCount) * 100
                            : (financialData.totalDay / Math.max(financialData.totalOrdersCount, 1)) * 100}%`
                        }}
                      />
                      <div
                        className="progress-bar-fill purple"
                        style={{
                          width: `${financialData.deliveredOrdersCount > 0
                            ? (financialData.deliveredNight / financialData.deliveredOrdersCount) * 100
                            : (financialData.totalNight / Math.max(financialData.totalOrdersCount, 1)) * 100}%`
                        }}
                      />
                    </div>
                    <div className="op-bar-legend">
                      <span>🟢 Diurno concretado: {financialData.deliveredDay}</span>
                      <span>🟣 Nocturno concretado: {financialData.deliveredNight}</span>
                    </div>
                  </div>
                </div>

                {/* Daily Revenue Chart */}
                {financialData.dailyStats.length > 0 && (
                  <div className="chart-section-box">
                    <div className="chart-header">
                      <div className="chart-title">Facturación por Día de Entrega</div>
                      <div className="chart-legend">Monto cobrado en entregas concretadas</div>
                    </div>
                    <div className="bar-chart">
                      {financialData.dailyStats.map((d, i) => (
                        <div key={i} className="bar-col">
                          <div className="bar-tooltip">
                            <strong>${d.revenue.toLocaleString('es-MX')} MXN</strong><br />
                            {d.orders} entregados
                          </div>
                          <div className="bar-wrap">
                            <div
                              className="bar-fill revenue-bar"
                              style={{ height: `${(d.revenue / maxRevenue) * 100}%` }}
                            />
                          </div>
                          <div className="bar-label">
                            {new Date(d.day + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SECTION: CMO & MARKETING FUNNEL                     */}
        {/* ══════════════════════════════════════════════════════ */}
        {(activeTab === 'all' || activeTab === 'cmo') && (
          <section className="dashboard-section">
            <div className="section-header">
              <div className="section-badge blue">PERSPECTIVA CMO & ADQUISICIÓN</div>
              <h2 className="section-heading">Embudo de Conversión & Tráfico de Clientes</h2>
              <p className="section-desc">
                Análisis de adquisición: desde la visita hasta la conversión real en Cancún.
              </p>
            </div>

            {/* Funnel Visualization */}
            <div className="funnel-container">
              <div className="funnel-step">
                <div className="funnel-step-badge">PASO 1</div>
                <div className="funnel-step-name">Visitantes Únicos</div>
                <div className="funnel-val">{funnelVisitors.toLocaleString('es-MX')}</div>
                <div className="funnel-sub">Tráfico orgánico & redes</div>
              </div>

              <div className="funnel-step">
                <div className="funnel-step-badge">PASO 2</div>
                <div className="funnel-step-name">Interés en Catálogo</div>
                <div className="funnel-val">{funnelCatalog.toLocaleString('es-MX')}</div>
                <div className="funnel-sub">Vistas a catálogo / pipas</div>
              </div>

              <div className="funnel-step">
                <div className="funnel-step-badge">PASO 3</div>
                <div className="funnel-step-name">Checkouts Iniciados</div>
                <div className="funnel-val">{funnelOrders.toLocaleString('es-MX')}</div>
                <div className="funnel-sub">Formularios de pedido creados</div>
              </div>

              <div className="funnel-step success">
                <div className="funnel-step-badge green">PASO 4</div>
                <div className="funnel-step-name">Clientes Convertidos</div>
                <div className="funnel-val green">{funnelDelivered.toLocaleString('es-MX')}</div>
                <div className="funnel-sub">Entregados y cobrados</div>
              </div>
            </div>

            {/* Visitor Traffic Breakdown */}
            {visitorsLoading ? (
              <div className="loading-grid four">
                {[...Array(4)].map((_, i) => <div key={i} className="loading-card" />)}
              </div>
            ) : visitors ? (
              <div className="bottom-grid" style={{ marginTop: 20 }}>
                {/* Top Pages */}
                <div className="section-card">
                  <div className="card-top-bar">
                    <span className="card-title">Páginas Más Populares</span>
                    <span className="card-tag">PostHog</span>
                  </div>
                  {visitors.topPages.length === 0 && <div className="empty-section">Sin datos registrados aún</div>}
                  {visitors.topPages.map((p, i) => (
                    <div key={i} className="prod-row">
                      <div className="prod-rank">#{i + 1}</div>
                      <div className="prod-info">
                        <div className="prod-name">{formatPagePath(p.path)}</div>
                        <div className="prod-bar-wrap">
                          <div
                            className="prod-bar visitor-bar"
                            style={{ width: `${(p.views / Math.max(visitors.topPages[0]?.views || 1, 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="prod-stats">
                        <span className="prod-qty">{p.views.toLocaleString('es-MX')} vistas</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Top Referrers & Devices */}
                <div className="section-card">
                  <div className="card-top-bar">
                    <span className="card-title">Atribución de Fuentes</span>
                    <span className="card-tag">Canales</span>
                  </div>
                  {visitors.topReferrers.length === 0 && <div className="empty-section">Sin datos aún</div>}
                  {visitors.topReferrers.map((r, i) => (
                    <div key={i} className="prod-row">
                      <div className="prod-rank">{getReferrerIcon(r.source)}</div>
                      <div className="prod-info">
                        <div className="prod-name">{r.source || 'Directo'}</div>
                      </div>
                      <div className="prod-stats">
                        <span className="prod-qty">{r.count.toLocaleString('es-MX')} visitas</span>
                      </div>
                    </div>
                  ))}

                  {visitors.devices.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div className="card-top-bar">
                        <span className="card-title">Dispositivos</span>
                      </div>
                      <div className="device-bars">
                        {visitors.devices.map((d, i) => {
                          const total = visitors.devices.reduce((s, x) => s + x.count, 0)
                          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
                          return (
                            <div key={i} className="device-row">
                              <span className="device-label">
                                {d.type === 'Mobile' ? '📱 Móvil' : d.type === 'Desktop' ? '💻 Escritorio' : '📱 ' + d.type}
                              </span>
                              <div className="device-bar-wrap">
                                <div className="device-bar" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="device-pct">{pct}%</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="section-card" style={{ marginTop: 20 }}>
                <div className="card-top-bar">
                  <span className="card-title">Canales y Tráfico Web</span>
                  <span className="card-tag">Estado</span>
                </div>
                <p className="empty-section">
                  Configura tus variables de PostHog (<code>POSTHOG_PROJECT_ID</code> y <code>POSTHOG_PERSONAL_API_KEY</code>) para ver atribución granular de visitantes en vivo.
                </p>
              </div>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SECTION: SEARCH DEMAND & SEO ACTIONS                */}
        {/* ══════════════════════════════════════════════════════ */}
        {(activeTab === 'all' || activeTab === 'seo' || activeTab === 'cmo') && (
          <section className="dashboard-section">
            <div className="section-header">
              <div className="section-badge gold">DEMANDA NO SATISFECHA & SEO</div>
              <h2 className="section-heading">Oportunidades de Inventario & Posicionamiento</h2>
              <p className="section-desc">
                Lo que los usuarios de Cancún buscan pero no encuentran, y palabras clave a punto de llegar al top de Google.
              </p>
            </div>

            <div className="bottom-grid">
              {/* Zero-result searches with 1-click action buttons */}
              <div className="section-card">
                <div className="card-top-bar">
                  <span className="card-title text-orange">⚠️ Demanda No Satisfecha (Sin Resultados)</span>
                  <span className="badge-warning">Alta Intención</span>
                </div>
                <p className="section-subtitle">
                  Términos buscados en el catálogo que dieron 0 resultados. Conviértelos en producto o contenido.
                </p>

                {searchesLoading ? (
                  <div className="loading-card tall" />
                ) : zeroResultSearches.length === 0 ? (
                  <div className="empty-section green-text">
                    ✓ Excelente: todas las búsquedas registradas de clientes encontraron productos en el catálogo.
                  </div>
                ) : (
                  <div className="search-actions-list">
                    {zeroResultSearches.map((s, i) => (
                      <div key={i} className="action-row">
                        <div className="action-info">
                          <div className="action-query">&ldquo;{s.query}&rdquo;</div>
                          <div className="action-count">{s.count} búsquedas perdidas</div>
                        </div>
                        <div className="action-buttons">
                          <Link
                            href={`/admin/products?new_name=${encodeURIComponent(s.query)}`}
                            className="btn-action btn-add-prod"
                            title="Crear este producto en catálogo"
                          >
                            + Producto
                          </Link>
                          <Link
                            href={`/admin/blog?title=${encodeURIComponent('Guía y opciones sobre ' + s.query)}`}
                            className="btn-action btn-add-blog"
                            title="Redactar un artículo en el blog sobre esto"
                          >
                            + Blog
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Striking distance keywords (GSC pos 6-20) with 1-click action */}
              <div className="section-card">
                <div className="card-top-bar">
                  <span className="card-title text-gold">⚡ Oportunidades SEO (Posición 6 a 20)</span>
                  <span className="badge-gold">Google Local</span>
                </div>
                <p className="section-subtitle">
                  Keywords en umbral de primera página en Cancún. Un post de blog las posiciona en top 3.
                </p>

                {keywordsLoading ? (
                  <div className="loading-card tall" />
                ) : strikingDistance.length === 0 ? (
                  <div className="empty-section">
                    Sin keywords en rango striking distance detectadas aún.
                  </div>
                ) : (
                  <div className="keyword-table">
                    <div className="kw-header">
                      <span className="kw-col-query">Keyword</span>
                      <span className="kw-col-num">Pos.</span>
                      <span className="kw-col-num">Impr.</span>
                      <span className="kw-col-action">Acción</span>
                    </div>
                    {strikingDistance.map((k, i) => (
                      <div key={i} className="kw-row strike">
                        <span className="kw-col-query font-medium">{k.query}</span>
                        <span className="kw-col-num">
                          <span className="pos-badge">{k.position.toFixed(1)}</span>
                        </span>
                        <span className="kw-col-num">{k.impressions.toLocaleString('es-MX')}</span>
                        <span className="kw-col-action">
                          <Link
                            href={`/admin/blog?title=${encodeURIComponent(k.query.charAt(0).toUpperCase() + k.query.slice(1) + ' en Cancún: Guía y Catálogo Completo')}`}
                            className="btn-action btn-add-blog small"
                            title="Crear post para rankear #1 en Cancún"
                          >
                            + Blog
                          </Link>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Organic Keywords & Top Searches */}
            <div className="bottom-grid" style={{ marginTop: 20 }}>
              {/* Top Searches */}
              <div className="section-card">
                <div className="card-top-bar">
                  <span className="card-title">🔍 Términos Más Buscados en Tienda</span>
                  <span className="card-tag">Catálogo</span>
                </div>
                {topSearches.length === 0 && <div className="empty-section">Sin búsquedas registradas aún</div>}
                {topSearches.map((s, i) => (
                  <div key={i} className="prod-row">
                    <div className="prod-rank">#{i + 1}</div>
                    <div className="prod-info">
                      <div className="prod-name">&ldquo;{s.query}&rdquo;</div>
                      <div className="prod-bar-wrap">
                        <div
                          className="prod-bar search-bar"
                          style={{ width: `${(s.count / Math.max(topSearches[0]?.count || 1, 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="prod-stats">
                      <span className="prod-qty">{s.count} veces</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Top Keywords Clicks */}
              <div className="section-card">
                <div className="card-top-bar">
                  <span className="card-title">🔑 Top Clics Orgánicos (Google)</span>
                  <span className="card-tag">GSC</span>
                </div>
                {topKeywords.length === 0 && <div className="empty-section">Sin datos de Google Search Console aún</div>}
                <div className="keyword-table">
                  <div className="kw-header">
                    <span className="kw-col-query">Keyword</span>
                    <span className="kw-col-num">Clics</span>
                    <span className="kw-col-num">Impr.</span>
                    <span className="kw-col-num">CTR</span>
                  </div>
                  {topKeywords.map((k, i) => (
                    <div key={i} className="kw-row">
                      <span className="kw-col-query">
                        <span className="kw-rank">#{i + 1}</span> {k.query}
                      </span>
                      <span className="kw-col-num kw-clicks">{k.clicks}</span>
                      <span className="kw-col-num">{k.impressions.toLocaleString('es-MX')}</span>
                      <span className="kw-col-num">{(k.ctr * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Long tail and blog keywords */}
            {(longTailKeywords.length > 0 || blogKeywords.length > 0) && (
              <div className="bottom-grid" style={{ marginTop: 20 }}>
                {longTailKeywords.length > 0 && (
                  <div className="section-card">
                    <div className="card-top-bar">
                      <span className="card-title">🎯 Keywords de Alta Intención (Cola Larga)</span>
                    </div>
                    {longTailKeywords.map((k, i) => (
                      <div key={i} className="kw-row">
                        <span className="kw-col-query longtail-query">&ldquo;{k.query}&rdquo;</span>
                        <span className="kw-col-num">{k.impressions} impr.</span>
                        <span className="kw-col-num kw-clicks">{k.clicks} clics</span>
                      </div>
                    ))}
                  </div>
                )}

                {blogKeywords.length > 0 && (
                  <div className="section-card">
                    <div className="card-top-bar">
                      <span className="card-title">📝 Tráfico del Blog</span>
                    </div>
                    {blogKeywords.map((k, i) => (
                      <div key={i} className="kw-row">
                        <span className="kw-col-query">
                          <span className="kw-rank">#{i + 1}</span> {k.query}
                        </span>
                        <span className="kw-col-num blog-page" title={k.page}>
                          {k.page.replace('https://distritopipa.com', '').replace('https://www.distritopipa.com', '')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SECTION: PRODUCTS & RECENT ACTIVITY                  */}
        {/* ══════════════════════════════════════════════════════ */}
        {(activeTab === 'all' || activeTab === 'commercial') && (
          <section className="dashboard-section">
            <div className="section-header">
              <div className="section-badge red">CATÁLOGO Y LEALTAD CONVERTIDA</div>
              <h2 className="section-heading">Productos Vendidos & Clientes Reales</h2>
            </div>

            <div className="bottom-grid">
              {/* Top products */}
              <div className="section-card">
                <div className="card-top-bar">
                  <span className="card-title">Top Productos por Volumen (Entregados)</span>
                  <Link href="/admin/products" className="card-action-link">Ver catálogo ➔</Link>
                </div>
                {financialData.topProducts.length === 0 && (
                  <div className="empty-section">Sin productos con entrega confirmada aún en este periodo</div>
                )}
                {financialData.topProducts.map((p, i) => (
                  <div key={p.name} className="prod-row">
                    <div className="prod-rank">#{i + 1}</div>
                    <div className="prod-info">
                      <div className="prod-name">{p.name}</div>
                      <div className="prod-bar-wrap">
                        <div
                          className="prod-bar"
                          style={{ width: `${(p.total_ordered / maxProd) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="prod-stats">
                      <span className="prod-qty">{p.total_ordered} piezas</span>
                      <span className="prod-rev">${p.revenue.toLocaleString('es-MX')}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Loyalty tiers & recent orders */}
              <div className="section-card">
                <div className="card-top-bar">
                  <span className="card-title">Lealtad (Clientes con Pedidos Entregados)</span>
                  <Link href="/admin/clients" className="card-action-link">Ver clientes ➔</Link>
                </div>
                
                {convertedClientsMetrics.convertedCount === 0 ? (
                  <div className="empty-section">
                    Aún no hay clientes con pedidos entregados. La lealtad se activará conforme se completen las entregas.
                  </div>
                ) : (
                  <>
                    <div className="tier-row">
                      <div className="tier-badge tier-gold">Gold ★★★ (Mayoreo/VIP)</div>
                      <div className="tier-bar-wrap">
                        <div
                          className="tier-bar"
                          style={{
                            width: `${(convertedClientsMetrics.gold / convertedClientsMetrics.convertedCount) * 100}%`,
                            background: '#fbbf24'
                          }}
                        />
                      </div>
                      <div className="tier-count">{convertedClientsMetrics.gold}</div>
                    </div>

                    <div className="tier-row">
                      <div className="tier-badge tier-silver">Silver ★★ (Frecuente)</div>
                      <div className="tier-bar-wrap">
                        <div
                          className="tier-bar"
                          style={{
                            width: `${(convertedClientsMetrics.silver / convertedClientsMetrics.convertedCount) * 100}%`,
                            background: '#9ca3af'
                          }}
                        />
                      </div>
                      <div className="tier-count">{convertedClientsMetrics.silver}</div>
                    </div>

                    <div className="tier-row">
                      <div className="tier-badge tier-bronze">Bronze ★ (Explorador)</div>
                      <div className="tier-bar-wrap">
                        <div
                          className="tier-bar"
                          style={{
                            width: `${(convertedClientsMetrics.bronze / convertedClientsMetrics.convertedCount) * 100}%`,
                            background: '#b45309'
                          }}
                        />
                      </div>
                      <div className="tier-count">{convertedClientsMetrics.bronze}</div>
                    </div>
                  </>
                )}

                <div className="card-top-bar" style={{ marginTop: 24 }}>
                  <span className="card-title">Últimos Pedidos Registrados</span>
                  <Link href="/admin/orders" className="card-action-link">Ver todos ➔</Link>
                </div>
                {financialData.recentOrders.length === 0 && <div className="empty-section">Sin pedidos registrados</div>}
                {financialData.recentOrders.map((o: any) => (
                  <div key={o.id} className="recent-row">
                    <div className="recent-num">
                      <strong>{o.order_number || o.id.slice(0, 8)}</strong>
                      <span className="recent-date">
                        {new Date(o.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div
                      className="recent-status"
                      style={{
                        color: o.status === 'delivered' ? '#4ade80' : (o.status === 'cancelled' || o.status === 'canceled') ? '#f87171' : '#fbbf24'
                      }}
                    >
                      {o.status === 'delivered' ? '✓ Entregado' : (o.status === 'cancelled' || o.status === 'canceled') ? '✗ Cancelado' : '⏳ ' + o.status}
                    </div>
                    <div className="recent-amount">${(o.total_mxn || 0).toLocaleString('es-MX')}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ────────────────────────────────────────────────────── */}
      {/* BRAND BOARD STYLES                                     */}
      {/* ────────────────────────────────────────────────────── */}
      <style>{`
        .analytics-page {
          min-height: 100vh;
          background-color: #111111;
          color: #ffffff;
          font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
          padding-bottom: 80px;
        }

        /* Header */
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 32px;
          background: #161616;
          border-bottom: 1px solid #2a2a2a;
          flex-wrap: wrap;
          gap: 16px;
        }
        .header-brand-wrap {
          max-width: 600px;
        }
        .brand-eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 700;
          color: #DC143C;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .live-dot {
          width: 8px;
          height: 8px;
          background: #DC143C;
          border-radius: 50%;
          box-shadow: 0 0 10px #DC143C;
          animation: pulse 2s infinite;
        }
        .brand-title {
          font-family: var(--font-bebas-neue), sans-serif;
          font-size: 32px;
          letter-spacing: 0.05em;
          color: #ffffff;
          margin: 0 0 4px 0;
          line-height: 1;
        }
        .brand-subtitle {
          font-size: 12px;
          color: #888888;
          margin: 0;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .range-tabs {
          display: flex;
          gap: 4px;
          background: #111111;
          padding: 4px;
          border-radius: 8px;
          border: 1px solid #2a2a2a;
        }
        .rtab {
          padding: 6px 14px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: #888888;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .rtab:hover {
          color: #ffffff;
        }
        .rtab.active {
          background: #DC143C;
          color: #ffffff;
        }
        .quick-links {
          display: flex;
          gap: 8px;
        }
        .q-link {
          font-size: 12px;
          font-weight: 600;
          color: #cccccc;
          background: #222222;
          border: 1px solid #333333;
          padding: 7px 12px;
          border-radius: 6px;
          text-decoration: none;
          transition: all 0.15s ease;
        }
        .q-link:hover {
          background: #DC143C;
          color: #ffffff;
          border-color: #DC143C;
        }

        /* Navigation tabs bar */
        .nav-tabs-bar {
          display: flex;
          gap: 8px;
          padding: 12px 32px;
          background: #111111;
          border-bottom: 1px solid #222222;
          overflow-x: auto;
        }
        .tab-btn {
          background: transparent;
          border: 1px solid transparent;
          color: #888888;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .tab-btn:hover {
          color: #ffffff;
          background: #1a1a1a;
        }
        .tab-btn.active {
          background: #1f1f1f;
          color: #ffffff;
          border-color: #DC143C;
        }

        /* Body container */
        .analytics-body {
          padding: 24px 32px;
          max-width: 1440px;
          margin: 0 auto;
        }

        /* Pipeline Audit Bar */
        .pipeline-audit-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #161616;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 16px 24px;
          margin-bottom: 28px;
          gap: 16px;
          flex-wrap: wrap;
        }
        .audit-item {
          display: flex;
          flex-direction: column;
        }
        .audit-lbl {
          font-size: 11px;
          font-weight: 700;
          color: #888888;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 4px;
        }
        .audit-val {
          font-family: var(--font-bebas-neue), sans-serif;
          font-size: 26px;
          color: #ffffff;
          line-height: 1;
        }
        .audit-val.green { color: #10b981; }
        .audit-val.gold { color: #fbbf24; }
        .audit-val.red { color: #f87171; }
        .audit-val.rate { color: #60a5fa; }
        .audit-sub {
          font-size: 11px;
          color: #666666;
          margin-top: 2px;
        }
        .audit-divider {
          color: #444444;
          font-weight: bold;
        }
        .rate-box {
          background: #1f1f1f;
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid #333333;
        }

        /* Dashboard Section */
        .dashboard-section {
          margin-bottom: 36px;
        }
        .section-header {
          margin-bottom: 16px;
        }
        .section-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 4px;
          margin-bottom: 6px;
        }
        .section-badge.red {
          background: rgba(220, 20, 60, 0.15);
          color: #DC143C;
          border: 1px solid rgba(220, 20, 60, 0.3);
        }
        .section-badge.blue {
          background: rgba(96, 165, 250, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(96, 165, 250, 0.3);
        }
        .section-badge.gold {
          background: rgba(251, 191, 36, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(251, 191, 36, 0.3);
        }
        .section-heading {
          font-family: var(--font-bebas-neue), sans-serif;
          font-size: 24px;
          letter-spacing: 0.04em;
          color: #ffffff;
          margin: 0 0 4px 0;
        }
        .section-desc {
          font-size: 12px;
          color: #888888;
          margin: 0;
        }

        /* Roadmap Grid */
        .roadmap-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        .roadmap-card {
          background: #181818;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }
        .rm-badge {
          font-size: 10px;
          font-weight: 700;
          color: #888888;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
        }
        .rm-title {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 4px;
        }
        .rm-desc {
          font-size: 12px;
          color: #777777;
          margin-bottom: 16px;
          line-height: 1.4;
          flex: 1;
        }
        .rm-progress-wrap {
          margin-bottom: 8px;
        }
        .rm-numbers {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-bottom: 6px;
        }
        .rm-current {
          font-family: var(--font-bebas-neue), sans-serif;
          font-size: 28px;
          color: #ffffff;
        }
        .rm-target {
          font-size: 12px;
          color: #666666;
        }
        .progress-bar-bg {
          height: 8px;
          background: #242424;
          border-radius: 4px;
          overflow: hidden;
        }
        .progress-bar-bg.dual {
          display: flex;
          height: 10px;
        }
        .progress-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.4s ease;
        }
        .progress-bar-fill.red { background: #DC143C; }
        .progress-bar-fill.gold { background: #fbbf24; }
        .progress-bar-fill.green { background: #10b981; }
        .progress-bar-fill.blue { background: #3b82f6; }
        .progress-bar-fill.purple { background: #a855f7; }
        .rm-status {
          font-size: 11px;
          font-weight: 600;
          color: #999999;
        }
        .rm-footnote {
          font-size: 10px;
          color: #555555;
          margin-top: 4px;
        }

        /* KPI Grid */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .kpi-card {
          background: #181818;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 16px;
        }
        .kpi-card.accent-border {
          border-left: 3px solid #DC143C;
        }
        .kpi-card.green-border {
          border-left: 3px solid #10b981;
        }
        .kpi-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #888888;
          margin-bottom: 8px;
        }
        .kpi-val {
          font-family: var(--font-bebas-neue), sans-serif;
          font-size: 30px;
          color: #ffffff;
          line-height: 1;
          margin-bottom: 6px;
        }
        .kpi-val.highlight { color: #DC143C; }
        .kpi-val.green { color: #10b981; }
        .kpi-val.gold { color: #fbbf24; }
        .kpi-val.muted { color: #9ca3af; }
        .kpi-percent {
          font-size: 16px;
          font-family: var(--font-inter), sans-serif;
          font-weight: 600;
          margin-left: 6px;
        }
        .kpi-sub {
          font-size: 11px;
          color: #666666;
          line-height: 1.3;
        }

        /* Operations Split Grid */
        .operations-split-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        @media(max-width: 768px) {
          .operations-split-grid { grid-template-columns: 1fr; }
        }
        .op-card {
          background: #181818;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 18px;
        }
        .op-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .op-icon {
          font-size: 24px;
        }
        .op-title {
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
        }
        .op-subtitle {
          font-size: 11px;
          color: #777777;
        }
        .op-metrics-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 14px;
        }
        .op-metric-block {
          flex: 1;
        }
        .op-val {
          font-family: var(--font-bebas-neue), sans-serif;
          font-size: 26px;
          color: #ffffff;
        }
        .op-val.night-val {
          color: #c084fc;
        }
        .op-lbl {
          font-size: 12px;
          font-weight: 600;
          color: #cccccc;
        }
        .op-detail {
          font-size: 11px;
          color: #888888;
          margin-top: 2px;
        }
        .op-tiny {
          font-size: 10px;
          color: #555555;
          margin-top: 2px;
        }
        .op-bar-legend {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          font-weight: 600;
          color: #888888;
          margin-top: 8px;
        }

        /* Chart Section */
        .chart-section-box {
          background: #181818;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
        }
        .chart-header {
          margin-bottom: 16px;
        }
        .chart-title {
          font-size: 13px;
          font-weight: 700;
          color: #cccccc;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .chart-legend {
          font-size: 11px;
          color: #666666;
        }
        .bar-chart {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          height: 140px;
          padding-top: 20px;
        }
        .bar-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          position: relative;
        }
        .bar-wrap {
          flex: 1;
          width: 100%;
          display: flex;
          align-items: flex-end;
        }
        .bar-fill {
          width: 100%;
          border-radius: 4px 4px 0 0;
          transition: height 0.3s ease;
        }
        .revenue-bar {
          background: linear-gradient(180deg, #DC143C, #880018);
        }
        .bar-label {
          font-size: 9px;
          color: #666666;
          margin-top: 6px;
          white-space: nowrap;
        }
        .bar-col:hover .bar-tooltip {
          display: block;
        }
        .bar-tooltip {
          display: none;
          position: absolute;
          bottom: 105%;
          left: 50%;
          transform: translateX(-50%);
          background: #2a2a2a;
          color: #ffffff;
          font-size: 11px;
          padding: 6px 10px;
          border-radius: 6px;
          white-space: nowrap;
          z-index: 10;
          text-align: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          border: 1px solid #444;
        }

        /* Funnel Container */
        .funnel-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .funnel-step {
          background: #181818;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 18px;
          position: relative;
        }
        .funnel-step.success {
          border-color: rgba(16, 185, 129, 0.4);
          background: #132219;
        }
        .funnel-step-badge {
          font-size: 9px;
          font-weight: 800;
          color: #888888;
          letter-spacing: 0.1em;
          margin-bottom: 6px;
        }
        .funnel-step-badge.green {
          color: #10b981;
        }
        .funnel-step-name {
          font-size: 13px;
          font-weight: 700;
          color: #dddddd;
          margin-bottom: 8px;
        }
        .funnel-val {
          font-family: var(--font-bebas-neue), sans-serif;
          font-size: 32px;
          color: #ffffff;
          line-height: 1;
          margin-bottom: 4px;
        }
        .funnel-val.green {
          color: #10b981;
        }
        .funnel-sub {
          font-size: 11px;
          color: #777777;
        }

        /* Bottom Grid */
        .bottom-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media(min-width: 840px) {
          .bottom-grid { grid-template-columns: 1fr 1fr; }
        }
        .section-card {
          background: #181818;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 20px;
        }
        .card-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .card-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #cccccc;
        }
        .card-title.text-orange { color: #fb923c; }
        .card-title.text-gold { color: #fbbf24; }
        .card-tag {
          font-size: 10px;
          color: #777777;
          background: #222222;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .card-action-link {
          font-size: 11px;
          font-weight: 600;
          color: #DC143C;
          text-decoration: none;
        }
        .card-action-link:hover {
          text-decoration: underline;
        }
        .badge-warning {
          font-size: 9px;
          font-weight: 700;
          color: #fb923c;
          background: rgba(251, 146, 60, 0.15);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .badge-gold {
          font-size: 9px;
          font-weight: 700;
          color: #fbbf24;
          background: rgba(251, 191, 36, 0.15);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .section-subtitle {
          font-size: 11px;
          color: #777777;
          margin-top: -8px;
          margin-bottom: 14px;
          line-height: 1.4;
        }
        .empty-section {
          font-size: 12px;
          color: #666666;
          padding: 16px 0;
        }
        .empty-section.green-text {
          color: #10b981;
        }

        /* Action Row (Zero Results) */
        .search-actions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .action-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(251, 146, 60, 0.05);
          border: 1px solid rgba(251, 146, 60, 0.15);
          border-radius: 8px;
          padding: 10px 14px;
          gap: 12px;
        }
        .action-info {
          flex: 1;
          min-width: 0;
        }
        .action-query {
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .action-count {
          font-size: 11px;
          color: #fb923c;
        }
        .action-buttons {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        .btn-action {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          padding: 5px 10px;
          border-radius: 6px;
          text-decoration: none;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .btn-action.small {
          font-size: 10px;
          padding: 3px 8px;
        }
        .btn-add-prod {
          background: #DC143C;
          color: #ffffff;
        }
        .btn-add-prod:hover {
          background: #b01030;
        }
        .btn-add-blog {
          background: #2563eb;
          color: #ffffff;
        }
        .btn-add-blog:hover {
          background: #1d4ed8;
        }

        /* Keyword Table */
        .keyword-table {
          display: flex;
          flex-direction: column;
        }
        .kw-header {
          display: flex;
          gap: 8px;
          padding: 6px 0;
          border-bottom: 1px solid #2a2a2a;
          font-size: 10px;
          font-weight: 700;
          color: #666666;
          text-transform: uppercase;
        }
        .kw-row {
          display: flex;
          gap: 8px;
          padding: 8px 0;
          border-bottom: 1px solid #222222;
          align-items: center;
          font-size: 12px;
        }
        .kw-row:last-child {
          border-bottom: none;
        }
        .kw-row.strike {
          background: rgba(251, 191, 36, 0.05);
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 4px;
        }
        .kw-col-query {
          flex: 1;
          min-width: 0;
          color: #e5e5e5;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .kw-col-num {
          width: 55px;
          text-align: right;
          color: #888888;
          font-size: 11px;
          flex-shrink: 0;
        }
        .kw-col-action {
          width: 70px;
          text-align: right;
          flex-shrink: 0;
        }
        .kw-rank {
          color: #666666;
          margin-right: 4px;
        }
        .kw-clicks {
          color: #DC143C;
          font-weight: 700;
        }
        .pos-badge {
          background: #fbbf24;
          color: #111111;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 800;
        }
        .longtail-query {
          color: #c084fc;
          font-style: italic;
        }
        .blog-page {
          color: #10b981;
          font-size: 10px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Products & Rows */
        .prod-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid #222222;
        }
        .prod-row:last-child {
          border-bottom: none;
        }
        .prod-rank {
          font-size: 12px;
          color: #666666;
          min-width: 24px;
        }
        .prod-info {
          flex: 1;
          min-width: 0;
        }
        .prod-name {
          font-size: 12px;
          color: #e0e0e0;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .prod-bar-wrap {
          height: 4px;
          background: #262626;
          border-radius: 2px;
          overflow: hidden;
        }
        .prod-bar {
          height: 100%;
          background: #DC143C;
          border-radius: 2px;
          transition: width 0.3s ease;
        }
        .prod-bar.visitor-bar { background: #3b82f6; }
        .prod-bar.search-bar { background: #a855f7; }
        .prod-stats {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          flex-shrink: 0;
        }
        .prod-qty {
          font-size: 11px;
          color: #888888;
        }
        .prod-rev {
          font-size: 11px;
          font-weight: 700;
          color: #DC143C;
        }

        /* Loyalty tiers */
        .tier-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #222222;
        }
        .tier-row:last-child { border-bottom: none; }
        .tier-badge {
          font-size: 12px;
          font-weight: 600;
          min-width: 150px;
        }
        .tier-gold { color: #fbbf24; }
        .tier-silver { color: #9ca3af; }
        .tier-bronze { color: #b45309; }
        .tier-bar-wrap {
          flex: 1;
          height: 6px;
          background: #242424;
          border-radius: 3px;
          overflow: hidden;
        }
        .tier-bar {
          height: 100%;
          border-radius: 3px;
        }
        .tier-count {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          min-width: 24px;
          text-align: right;
        }

        /* Recent orders */
        .recent-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #222222;
          font-size: 12px;
        }
        .recent-num {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #dddddd;
        }
        .recent-date {
          font-size: 10px;
          color: #666666;
        }
        .recent-status {
          font-weight: 600;
          font-size: 11px;
        }
        .recent-amount {
          font-family: var(--font-bebas-neue), sans-serif;
          font-size: 16px;
          color: #ffffff;
        }

        /* Devices */
        .device-bars {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .device-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .device-label {
          font-size: 11px;
          color: #888888;
          min-width: 90px;
        }
        .device-bar-wrap {
          flex: 1;
          height: 6px;
          background: #262626;
          border-radius: 3px;
          overflow: hidden;
        }
        .device-bar {
          height: 100%;
          background: #3b82f6;
          border-radius: 3px;
        }
        .device-pct {
          font-size: 11px;
          font-weight: 700;
          color: #ffffff;
          min-width: 32px;
          text-align: right;
        }

        /* Loading & Pulse */
        .loading-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .loading-card {
          height: 100px;
          background: #181818;
          border: 1px solid #242424;
          border-radius: 12px;
          animation: pulse 1.5s infinite;
        }
        .loading-card.tall {
          height: 200px;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

// ── Helper functions ────────────────────────────────────────
function formatPagePath(path: string): string {
  if (!path || path === '/') return 'Inicio (Home)'
  const clean = path
    .replace('https://distritopipa.com', '')
    .replace('https://www.distritopipa.com', '')
  if (clean.startsWith('/producto/')) return clean.replace('/producto/', '📦 ')
  if (clean.startsWith('/blog/')) return clean.replace('/blog/', '📝 ')
  if (clean === '/catalogo') return '🛒 Catálogo General'
  if (clean === '/mayoreo') return '📋 Mayoreo Cancún'
  if (clean === '/comunidad') return '💬 Comunidad'
  if (clean === '/checkout') return '💳 Checkout'
  return clean
}

function getReferrerIcon(source: string): string {
  const s = (source || '').toLowerCase()
  if (s.includes('google')) return '🔍'
  if (s.includes('instagram') || s.includes('ig')) return '📸'
  if (s.includes('facebook') || s.includes('fb')) return '📘'
  if (s.includes('whatsapp') || s.includes('wa')) return '💬'
  if (s.includes('tiktok')) return '🎵'
  if (s.includes('twitter') || s.includes('x.com')) return '🐦'
  if (!s || s === 'direct' || s === '(direct)' || s.includes('directo')) return '🔗'
  return '🌐'
}
