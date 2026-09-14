'use client'
// app/admin/analytics/page.tsx
// ─────────────────────────────────────────────────────────────
// Complete admin analytics: business metrics + visitor traffic
// + SEO keywords + on-site search intelligence + UTM campaigns
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { supabaseAdmin } from '@/lib/supabase'

interface DayStat { day: string; orders: number; revenue: number }
interface ProductStat { name: string; category: string; total_ordered: number; revenue: number }
interface TierStat { tier: string; count: number }
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
  const [range, setRange]           = useState<7|30|90>(30)
  const [loading, setLoading]       = useState(true)

  // Business metric cards
  const [totalRevenue, setTotalRevenue]   = useState(0)
  const [totalOrders, setTotalOrders]     = useState(0)
  const [avgOrder, setAvgOrder]           = useState(0)
  const [activeCustomers, setActive]      = useState(0)
  const [pendingDeposits, setPending]     = useState(0)
  const [conversionRate, setConversion]   = useState(0)

  // Charts
  const [dailyStats, setDailyStats]       = useState<DayStat[]>([])
  const [topProducts, setTopProducts]     = useState<ProductStat[]>([])
  const [tierStats, setTierStats]         = useState<TierStat[]>([])
  const [recentOrders, setRecentOrders]   = useState<any[]>([])

  // NEW: Visitor analytics (from PostHog)
  const [visitors, setVisitors]           = useState<VisitorData | null>(null)
  const [visitorsLoading, setVisitorsLoading] = useState(true)

  // NEW: Site search analytics
  const [topSearches, setTopSearches]     = useState<SearchStat[]>([])
  const [zeroResultSearches, setZeroResults] = useState<SearchStat[]>([])
  const [searchesLoading, setSearchesLoading] = useState(true)

  // NEW: SEO keywords (from GSC)
  const [topKeywords, setTopKeywords]     = useState<KeywordStat[]>([])
  const [strikingDistance, setStrikingDistance] = useState<KeywordStat[]>([])
  const [longTailKeywords, setLongTail]   = useState<KeywordStat[]>([])
  const [blogKeywords, setBlogKeywords]   = useState<KeywordStat[]>([])
  const [keywordsLoading, setKeywordsLoading] = useState(true)

  useEffect(() => { loadAll() }, [range]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true)
    setVisitorsLoading(true)
    setSearchesLoading(true)
    setKeywordsLoading(true)

    const since = new Date()
    since.setDate(since.getDate() - range)
    const sinceISO = since.toISOString()

    // Run all data fetches in parallel
    await Promise.all([
      loadBusinessMetrics(sinceISO),
      loadVisitorData(),
      loadSearchData(sinceISO),
      loadKeywordData(),
    ])
  }

  // ── Business Metrics (existing) ──────────────────────────
  async function loadBusinessMetrics(sinceISO: string) {
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id, total_mxn, status, items, created_at, customer_phone')
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: false })

    if (orders) {
      const delivered = orders.filter(o => o.status === 'delivered')
      const rev = delivered.reduce((s: number, o: any) => s + (o.total_mxn || 0), 0)
      setTotalRevenue(rev)
      setTotalOrders(orders.length)
      setAvgOrder(delivered.length ? rev / delivered.length : 0)
      setPending(orders.filter((o: any) => o.status === 'pending').length)

      // Daily stats
      const byDay: Record<string, DayStat> = {}
      orders.forEach((o: any) => {
        const day = o.created_at.slice(0, 10)
        if (!byDay[day]) byDay[day] = { day, orders: 0, revenue: 0 }
        byDay[day].orders++
        if (o.status === 'delivered') byDay[day].revenue += o.total_mxn || 0
      })
      setDailyStats(
        Object.values(byDay)
          .sort((a, b) => a.day.localeCompare(b.day))
          .slice(-14)
      )

      // Top products from items JSONB
      const productMap: Record<string, ProductStat> = {}
      orders.forEach((o: any) => {
        if (!Array.isArray(o.items)) return
        o.items.forEach((item: any) => {
          const key = item.name
          if (!productMap[key]) productMap[key] = { name: key, category: '', total_ordered: 0, revenue: 0 }
          productMap[key].total_ordered += item.qty || 1
          productMap[key].revenue += item.bundle_price ?? (item.unit_price * item.qty)
        })
      })
      setTopProducts(
        Object.values(productMap)
          .sort((a, b) => b.total_ordered - a.total_ordered)
          .slice(0, 8)
      )

      setRecentOrders(orders.slice(0, 5))

      // Conversion rate
      if (orders.length) {
        const del = orders.filter((o: any) => o.status === 'delivered').length
        setConversion(Math.round((del / orders.length) * 100))
      }
    }

    // Customers
    const { count: custCount } = await supabaseAdmin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sinceISO)
    setActive(custCount || 0)

    // Loyalty tier distribution
    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('tier')
    if (customers) {
      const tiers: Record<string,number> = { bronze:0, silver:0, gold:0 }
      customers.forEach((c: any) => { if (tiers[c.tier] !== undefined) tiers[c.tier]++ })
      setTierStats([
        { tier: 'Gold ★★★',   count: tiers.gold },
        { tier: 'Silver ★★',  count: tiers.silver },
        { tier: 'Bronze ★',   count: tiers.bronze },
      ])
    }

    setLoading(false)
  }

  // ── Visitor Analytics (PostHog API) ───────────────────────
  async function loadVisitorData() {
    try {
      const res = await fetch(`/api/admin/analytics/visitors?days=${range}`)
      const data = await res.json()
      if (res.ok) {
        setVisitors(data)
      } else {
        console.error('Visitor API error:', res.status, data)
        setVisitors(null)
      }
    } catch (e) {
      console.error('Failed to load visitor data:', e)
    }
    setVisitorsLoading(false)
  }

  // ── On-Site Search Analytics ──────────────────────────────
  async function loadSearchData(sinceISO: string) {
    try {
      // Top searched terms
      const { data: topData } = await supabaseAdmin
        .from('site_search_logs')
        .select('normalized_query')
        .gte('created_at', sinceISO)

      if (topData && topData.length > 0) {
        const counts: Record<string, number> = {}
        topData.forEach((r: any) => {
          counts[r.normalized_query] = (counts[r.normalized_query] || 0) + 1
        })
        const sorted = Object.entries(counts)
          .map(([query, count]) => ({ query, count, zero_results: false }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
        setTopSearches(sorted)
      }

      // Zero-result searches
      const { data: zeroData } = await supabaseAdmin
        .from('site_search_logs')
        .select('normalized_query')
        .gte('created_at', sinceISO)
        .eq('results_count', 0)

      if (zeroData && zeroData.length > 0) {
        const counts: Record<string, number> = {}
        zeroData.forEach((r: any) => {
          counts[r.normalized_query] = (counts[r.normalized_query] || 0) + 1
        })
        const sorted = Object.entries(counts)
          .map(([query, count]) => ({ query, count, zero_results: true }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
        setZeroResults(sorted)
      }
    } catch (e) {
      console.error('Failed to load search data:', e)
    }
    setSearchesLoading(false)
  }

  // ── SEO Keywords (via server-side API — needs service role) ──
  async function loadKeywordData() {
    try {
      const res = await fetch(`/api/admin/analytics/keywords?days=${range}`)
      const data = await res.json()
      if (res.ok) {
        setTopKeywords(data.topKeywords || [])
        setStrikingDistance(data.strikingDistance || [])
        setLongTail(data.longTailKeywords || [])
        setBlogKeywords(data.blogKeywords || [])
      } else {
        console.error('Keywords API error:', res.status, data)
      }
    } catch (e) {
      console.error('Failed to load keyword data:', e)
    }
    setKeywordsLoading(false)
  }

  // ── Helper values for charts ────────────────────────────
  const maxRevenue = Math.max(...dailyStats.map(d => d.revenue), 1)
  const maxProd    = Math.max(...topProducts.map(p => p.total_ordered), 1)

  // ─────────────────────────────────────────────────────────
  return (
    <div className="analytics-page">

      <div className="page-header">
        <div>
          <div className="page-eyebrow">Métricas del negocio</div>
          <h1 className="page-title">Analytics</h1>
        </div>
        <div className="range-tabs">
          {([7,30,90] as const).map(r => (
            <button key={r}
              className={`rtab ${range===r?'active':''}`}
              onClick={() => setRange(r)}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 1: VISITOR TRAFFIC (PostHog)                   */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="section-divider">
        <span className="section-icon">👁️</span>
        <span>Tráfico del sitio</span>
      </div>

      {visitorsLoading ? (
        <div className="loading-grid four">
          {[...Array(4)].map((_,i) => <div key={i} className="loading-card" />)}
        </div>
      ) : visitors ? (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Visitantes únicos</div>
              <div className="kpi-val visitor">{visitors.uniqueVisitors.toLocaleString('es-MX')}</div>
              <div className="kpi-sub">últimos {range} días</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Páginas vistas</div>
              <div className="kpi-val">{visitors.pageviews.toLocaleString('es-MX')}</div>
              <div className="kpi-sub">total de vistas</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Pág/visitante</div>
              <div className="kpi-val">
                {visitors.uniqueVisitors > 0
                  ? (visitors.pageviews / visitors.uniqueVisitors).toFixed(1)
                  : '0'}
              </div>
              <div className="kpi-sub">promedio de páginas</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Dispositivo principal</div>
              <div className="kpi-val" style={{fontSize:16}}>
                {visitors.devices.length > 0
                  ? `${visitors.devices[0].type === 'Mobile' ? '📱' : '💻'} ${visitors.devices[0].type}`
                  : '—'}
              </div>
              <div className="kpi-sub">
                {visitors.devices.length > 0
                  ? `${Math.round((visitors.devices[0].count / Math.max(visitors.uniqueVisitors, 1)) * 100)}% del tráfico`
                  : ''}
              </div>
            </div>
          </div>

          <div className="bottom-grid">
            {/* Top Pages */}
            <div className="section-card">
              <div className="section-title">Páginas más vistas</div>
              {visitors.topPages.length === 0 && <div className="empty-section">Sin datos aún</div>}
              {visitors.topPages.map((p, i) => (
                <div key={i} className="prod-row">
                  <div className="prod-rank">#{i+1}</div>
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

            {/* Top Referrers + Device Split */}
            <div className="section-card">
              <div className="section-title">Fuentes de tráfico</div>
              {visitors.topReferrers.length === 0 && <div className="empty-section">Sin datos aún</div>}
              {visitors.topReferrers.map((r, i) => (
                <div key={i} className="prod-row">
                  <div className="prod-rank">{getReferrerIcon(r.source)}</div>
                  <div className="prod-info">
                    <div className="prod-name">{r.source || 'Directo'}</div>
                  </div>
                  <div className="prod-stats">
                    <span className="prod-qty">{r.count.toLocaleString('es-MX')}</span>
                  </div>
                </div>
              ))}

              {visitors.devices.length > 0 && (
                <>
                  <div className="section-title" style={{marginTop:16}}>Dispositivos</div>
                  <div className="device-bars">
                    {visitors.devices.map((d, i) => {
                      const total = visitors.devices.reduce((s, x) => s + x.count, 0)
                      const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
                      return (
                        <div key={i} className="device-row">
                          <span className="device-label">
                            {d.type === 'Mobile' ? '📱' : d.type === 'Desktop' ? '💻' : '📱'} {d.type}
                          </span>
                          <div className="device-bar-wrap">
                            <div className="device-bar" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="device-pct">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="section-card" style={{margin: '0 20px'}}>
          <div className="empty-section">
            Configura <code>POSTHOG_PERSONAL_API_KEY</code> y <code>POSTHOG_PROJECT_ID</code> en tus variables de entorno para ver el tráfico del sitio.
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 2: BUSINESS METRICS (existing)                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="section-divider">
        <span className="section-icon">💰</span>
        <span>Métricas del negocio</span>
      </div>

      {loading ? (
        <div className="loading-grid">
          {[...Array(6)].map((_,i) => <div key={i} className="loading-card" />)}
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Ingresos ({range}d)</div>
              <div className="kpi-val revenue">${totalRevenue.toLocaleString('es-MX')}</div>
              <div className="kpi-sub">MXN · pedidos entregados</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Pedidos totales</div>
              <div className="kpi-val">{totalOrders}</div>
              <div className="kpi-sub">{pendingDeposits} pendientes de anticipo</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Ticket promedio</div>
              <div className="kpi-val">${Math.round(avgOrder).toLocaleString('es-MX')}</div>
              <div className="kpi-sub">MXN por pedido entregado</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Clientes nuevos</div>
              <div className="kpi-val">{activeCustomers}</div>
              <div className="kpi-sub">en los últimos {range} días</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Tasa de conversión</div>
              <div className="kpi-val">{conversionRate}%</div>
              <div className="kpi-sub">pedidos → entregados</div>
            </div>
            <div className="kpi-card" style={{borderColor: pendingDeposits>0?'rgba(251,146,60,.3)':''}}>
              <div className="kpi-label">Sin anticipo</div>
              <div className="kpi-val" style={{color: pendingDeposits>0?'#fb923c':'#4ade80'}}>
                {pendingDeposits}
              </div>
              <div className="kpi-sub">pedidos esperando depósito</div>
            </div>
          </div>

          {/* Revenue chart */}
          {dailyStats.length > 0 && (
            <div className="chart-section">
              <div className="chart-title">Ingresos diarios (últimos 14 días)</div>
              <div className="bar-chart">
                {dailyStats.map((d, i) => (
                  <div key={i} className="bar-col">
                    <div className="bar-tooltip">${d.revenue.toLocaleString('es-MX')}<br/>{d.orders} pedidos</div>
                    <div className="bar-wrap">
                      <div
                        className="bar-fill revenue-bar"
                        style={{ height: `${(d.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                    <div className="bar-label">
                      {new Date(d.day+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'})}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom row: top products + loyalty */}
          <div className="bottom-grid">
            <div className="section-card">
              <div className="section-title">Productos más vendidos</div>
              {topProducts.length === 0 && <div className="empty-section">Sin datos aún</div>}
              {topProducts.map((p, i) => (
                <div key={p.name} className="prod-row">
                  <div className="prod-rank">#{i+1}</div>
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
                    <span className="prod-qty">{p.total_ordered} uds</span>
                    <span className="prod-rev">${p.revenue.toLocaleString('es-MX')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="section-card">
              <div className="section-title">Programa de lealtad</div>
              {tierStats.map(t => (
                <div key={t.tier} className="tier-row">
                  <div className={`tier-badge tier-${t.tier.split(' ')[0].toLowerCase()}`}>
                    {t.tier}
                  </div>
                  <div className="tier-bar-wrap">
                    <div
                      className="tier-bar"
                      style={{
                        width: `${Math.max((t.count / Math.max(...tierStats.map(x=>x.count),1))*100, t.count?8:0)}%`,
                        background: t.tier.startsWith('Gold')?'#fbbf24':t.tier.startsWith('Silver')?'#9ca3af':'#b45309'
                      }}
                    />
                  </div>
                  <div className="tier-count">{t.count}</div>
                </div>
              ))}

              <div className="section-title" style={{marginTop:20}}>Pedidos recientes</div>
              {recentOrders.map((o: any) => (
                <div key={o.id} className="recent-row">
                  <div className="recent-num">{o.order_number || o.id.slice(0,8)}</div>
                  <div className="recent-status"
                    style={{color: o.status==='delivered'?'#4ade80':o.status==='pending'?'#fbbf24':'#60a5fa'}}>
                    {o.status}
                  </div>
                  <div className="recent-amount">${(o.total_mxn||0).toLocaleString('es-MX')}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 3: SEO & KEYWORDS (GSC)                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="section-divider">
        <span className="section-icon">🎯</span>
        <span>SEO & Keywords</span>
      </div>

      {keywordsLoading ? (
        <div className="loading-grid two">
          {[...Array(2)].map((_,i) => <div key={i} className="loading-card tall" />)}
        </div>
      ) : topKeywords.length === 0 && strikingDistance.length === 0 ? (
        <div className="section-card" style={{margin: '0 20px'}}>
          <div className="empty-section">
            Configura la integración con Google Search Console para ver los keywords orgánicos.
            <br/><span style={{fontSize:10,color:'#555'}}>
              Variables requeridas: GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, GSC_SITE_URL, CRON_SECRET
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="bottom-grid">
            {/* Top Keywords */}
            <div className="section-card">
              <div className="section-title">🔑 Keywords con más clics</div>
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
                      <span className="kw-rank">#{i+1}</span> {k.query}
                    </span>
                    <span className="kw-col-num kw-clicks">{k.clicks}</span>
                    <span className="kw-col-num">{k.impressions.toLocaleString('es-MX')}</span>
                    <span className="kw-col-num">{(k.ctr * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Striking Distance */}
            <div className="section-card">
              <div className="section-title">⚡ Oportunidades (pos. 6–20)</div>
              <div className="section-subtitle">Keywords cerca de la primera página — un empujón más y suben al top</div>
              {strikingDistance.length === 0 && <div className="empty-section">Sin oportunidades detectadas</div>}
              <div className="keyword-table">
                <div className="kw-header">
                  <span className="kw-col-query">Keyword</span>
                  <span className="kw-col-num">Pos.</span>
                  <span className="kw-col-num">Impr.</span>
                </div>
                {strikingDistance.map((k, i) => (
                  <div key={i} className="kw-row strike">
                    <span className="kw-col-query">{k.query}</span>
                    <span className="kw-col-num">
                      <span className="pos-badge">{k.position.toFixed(1)}</span>
                    </span>
                    <span className="kw-col-num">{k.impressions.toLocaleString('es-MX')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Long-tail + Blog Keywords */}
          <div className="bottom-grid" style={{marginTop: 12}}>
            {/* Long-tail Keywords */}
            <div className="section-card">
              <div className="section-title">🔍 Keywords de cola larga</div>
              <div className="section-subtitle">Frases de 3+ palabras con alta intención de compra</div>
              {longTailKeywords.length === 0 && <div className="empty-section">Sin datos aún</div>}
              {longTailKeywords.map((k, i) => (
                <div key={i} className="kw-row">
                  <span className="kw-col-query longtail-query">&ldquo;{k.query}&rdquo;</span>
                  <span className="kw-col-num">{k.impressions} impr.</span>
                  <span className="kw-col-num kw-clicks">{k.clicks} clics</span>
                </div>
              ))}
            </div>

            {/* Blog Keywords */}
            <div className="section-card">
              <div className="section-title">📝 Keywords del Blog</div>
              <div className="section-subtitle">Qué busca la gente para encontrar tus artículos</div>
              {blogKeywords.length === 0 && <div className="empty-section">Sin datos aún — publica más artículos para aparecer aquí</div>}
              {blogKeywords.map((k, i) => (
                <div key={i} className="kw-row">
                  <span className="kw-col-query">
                    <span className="kw-rank">#{i+1}</span> {k.query}
                  </span>
                  <span className="kw-col-num blog-page" title={k.page}>
                    {k.page.replace('https://distritopipa.com', '').replace('https://www.distritopipa.com', '')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 4: ON-SITE SEARCH INTELLIGENCE                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="section-divider">
        <span className="section-icon">🔎</span>
        <span>Búsquedas del sitio</span>
      </div>

      {searchesLoading ? (
        <div className="loading-grid two">
          {[...Array(2)].map((_,i) => <div key={i} className="loading-card tall" />)}
        </div>
      ) : topSearches.length === 0 && zeroResultSearches.length === 0 ? (
        <div className="section-card" style={{margin: '0 20px'}}>
          <div className="empty-section">
            Aún no hay búsquedas registradas. Los datos aparecerán cuando los clientes busquen en el catálogo.
          </div>
        </div>
      ) : (
        <div className="bottom-grid">
          {/* Top Searches */}
          <div className="section-card">
            <div className="section-title">Términos más buscados</div>
            {topSearches.length === 0 && <div className="empty-section">Sin datos aún</div>}
            {topSearches.map((s, i) => (
              <div key={i} className="prod-row">
                <div className="prod-rank">#{i+1}</div>
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

          {/* Zero Results */}
          <div className="section-card">
            <div className="section-title" style={{color:'#fb923c'}}>⚠️ Búsquedas sin resultados</div>
            <div className="section-subtitle">Los clientes buscan esto pero no lo encuentran — oportunidad de inventario</div>
            {zeroResultSearches.length === 0 && (
              <div className="empty-section" style={{color:'#4ade80'}}>
                ✓ Todas las búsquedas devuelven resultados
              </div>
            )}
            {zeroResultSearches.map((s, i) => (
              <div key={i} className="prod-row zero-result-row">
                <div className="prod-rank" style={{color:'#fb923c'}}>!</div>
                <div className="prod-info">
                  <div className="prod-name">&ldquo;{s.query}&rdquo;</div>
                </div>
                <div className="prod-stats">
                  <span className="prod-qty" style={{color:'#fb923c'}}>{s.count} veces</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* STYLES                                                  */}
      {/* ═══════════════════════════════════════════════════════ */}
      <style>{`
        .analytics-page{min-height:100vh;background:#111;color:#fff;font-family:-apple-system,sans-serif;padding-bottom:60px}
        .page-header{display:flex;align-items:center;justify-content:space-between;padding:28px 20px 20px;border-bottom:1px solid #2a2a2a;flex-wrap:wrap;gap:12px}
        .page-eyebrow{font-size:10px;color:#888;letter-spacing:.12em;text-transform:uppercase;margin-bottom:3px}
        .page-title{font-size:22px;font-weight:600}
        .range-tabs{display:flex;gap:6px}
        .rtab{padding:7px 14px;border-radius:8px;border:0.5px solid #2a2a2a;background:transparent;color:#888;font-size:12px;cursor:pointer;transition:all .15s}
        .rtab:hover{color:#fff}
        .rtab.active{background:#CC2222;color:#fff;border-color:#CC2222}

        /* Section dividers */
        .section-divider{display:flex;align-items:center;gap:10px;padding:24px 20px 8px;font-size:13px;font-weight:600;color:#ccc;text-transform:uppercase;letter-spacing:.06em;border-top:1px solid #1a1a1a;margin-top:12px}
        .section-icon{font-size:16px}

        /* KPI grid */
        .kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;padding:12px 20px}
        .kpi-card{background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:10px;padding:14px}
        .kpi-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
        .kpi-val{font-size:22px;font-weight:600;color:#fff;margin-bottom:4px}
        .kpi-val.revenue{color:#CC2222}
        .kpi-val.visitor{color:#60a5fa}
        .kpi-sub{font-size:10px;color:#555}

        /* Loading */
        .loading-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;padding:12px 20px}
        .loading-grid.four{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
        .loading-grid.two{grid-template-columns:1fr 1fr;padding:0 20px}
        .loading-card{height:90px;background:#1a1a1a;border-radius:10px;animation:pulse 1.5s ease-in-out infinite}
        .loading-card.tall{height:200px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

        /* Revenue chart */
        .chart-section{padding:0 20px 20px}
        .chart-title{font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px}
        .bar-chart{display:flex;align-items:flex-end;gap:4px;height:120px;background:#1a1a1a;border-radius:10px;padding:12px 12px 0}
        .bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;height:100%}
        .bar-col:hover .bar-tooltip{display:block}
        .bar-tooltip{display:none;position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:#2a2a2a;color:#fff;font-size:10px;padding:5px 8px;border-radius:5px;white-space:nowrap;z-index:10;text-align:center;margin-bottom:4px;line-height:1.4}
        .bar-wrap{flex:1;width:100%;display:flex;align-items:flex-end}
        .bar-fill{width:100%;border-radius:3px 3px 0 0;transition:height .3s ease}
        .revenue-bar{background:#CC2222}
        .bar-label{font-size:9px;color:#555;white-space:nowrap;padding-bottom:6px}

        /* Bottom grid */
        .bottom-grid{display:grid;grid-template-columns:1fr;gap:12px;padding:0 20px}
        @media(min-width:768px){.bottom-grid{grid-template-columns:1fr 1fr}}
        .section-card{background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:10px;padding:16px}
        .section-title{font-size:10px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px}
        .section-subtitle{font-size:11px;color:#555;margin-bottom:12px;margin-top:-8px;line-height:1.4}
        .empty-section{font-size:13px;color:#555;padding:10px 0;line-height:1.5}
        .empty-section code{background:#2a2a2a;padding:2px 6px;border-radius:4px;font-size:11px;color:#888}

        /* Top products */
        .prod-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:0.5px solid #2a2a2a}
        .prod-row:last-child{border:none}
        .prod-rank{font-size:12px;color:#555;min-width:22px}
        .prod-info{flex:1;min-width:0}
        .prod-name{font-size:12px;color:#ccc;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .prod-bar-wrap{height:3px;background:#2a2a2a;border-radius:2px;overflow:hidden}
        .prod-bar{height:100%;background:#CC2222;border-radius:2px;transition:width .3s ease}
        .prod-bar.visitor-bar{background:#60a5fa}
        .prod-bar.search-bar{background:#a78bfa}
        .prod-stats{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0}
        .prod-qty{font-size:11px;color:#888}
        .prod-rev{font-size:11px;color:#CC2222;font-weight:500}

        /* Loyalty */
        .tier-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid #2a2a2a}
        .tier-row:last-child{border:none}
        .tier-badge{font-size:11px;font-weight:500;min-width:80px}
        .tier-gold{color:#fbbf24}
        .tier-silver{color:#9ca3af}
        .tier-bronze{color:#b45309}
        .tier-bar-wrap{flex:1;height:4px;background:#2a2a2a;border-radius:2px;overflow:hidden}
        .tier-bar{height:100%;border-radius:2px;transition:width .3s ease}
        .tier-count{font-size:13px;font-weight:600;color:#fff;min-width:24px;text-align:right}

        /* Recent orders */
        .recent-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:0.5px solid #1a1a1a;font-size:12px}
        .recent-num{color:#888;flex:1}
        .recent-status{font-weight:500;text-transform:capitalize}
        .recent-amount{color:#CC2222;font-weight:600}

        /* Keywords */
        .keyword-table{display:flex;flex-direction:column;gap:0}
        .kw-header{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #2a2a2a;font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.08em}
        .kw-row{display:flex;gap:8px;padding:7px 0;border-bottom:0.5px solid #1e1e1e;align-items:center;font-size:12px}
        .kw-row:last-child{border:none}
        .kw-row.strike{background:rgba(251,146,60,.04);border-radius:4px;padding:7px 4px}
        .kw-col-query{flex:1;min-width:0;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .kw-col-num{width:60px;text-align:right;color:#888;flex-shrink:0;font-size:11px}
        .kw-rank{color:#555;margin-right:4px}
        .kw-clicks{color:#CC2222;font-weight:600}
        .longtail-query{color:#a78bfa;font-style:italic;font-size:11px}
        .pos-badge{background:#fb923c;color:#111;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700}
        .blog-page{font-size:10px;color:#4ade80;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:auto;flex:0 0 auto}

        /* Zero result rows */
        .zero-result-row{background:rgba(251,146,60,.05);border-radius:4px;padding:6px 8px}

        /* Device bars */
        .device-bars{display:flex;flex-direction:column;gap:8px}
        .device-row{display:flex;align-items:center;gap:8px}
        .device-label{font-size:11px;color:#888;min-width:70px}
        .device-bar-wrap{flex:1;height:6px;background:#2a2a2a;border-radius:3px;overflow:hidden}
        .device-bar{height:100%;background:#60a5fa;border-radius:3px;transition:width .3s ease}
        .device-pct{font-size:12px;color:#fff;font-weight:600;min-width:32px;text-align:right}
      `}</style>
    </div>
  )
}

// ── Helper functions ──────────────────────────────────────
function formatPagePath(path: string): string {
  if (!path || path === '/') return 'Inicio'
  const clean = path
    .replace('https://distritopipa.com', '')
    .replace('https://www.distritopipa.com', '')
  if (clean.startsWith('/producto/')) return clean.replace('/producto/', '📦 ')
  if (clean.startsWith('/blog/')) return clean.replace('/blog/', '📝 ')
  if (clean === '/catalogo') return '🛒 Catálogo'
  if (clean === '/mayoreo') return '📋 Mayoreo'
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
  if (!s || s === 'direct' || s === '(direct)') return '🔗'
  return '🌐'
}
