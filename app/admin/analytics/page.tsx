'use client'
// app/admin/analytics/page.tsx
// Real data from Supabase. No third-party analytics SDK needed for admin view.
// Plausible handles public traffic analytics — this handles business metrics.

import { useState, useEffect } from 'react'
import { supabaseAdmin } from '@/lib/supabase'

interface DayStat { day: string; orders: number; revenue: number }
interface ProductStat { name: string; category: string; total_ordered: number; revenue: number }
interface TierStat { tier: string; count: number }

export default function AdminAnalyticsPage() {
  const [range, setRange]           = useState<7|30|90>(30)
  const [loading, setLoading]       = useState(true)

  // Metric cards
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

  useEffect(() => { loadAll() }, [range])

  async function loadAll() {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - range)
    const sinceISO = since.toISOString()

    // ── Orders in range ──────────────────────────────────────
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
          .slice(-14) // last 14 days for chart
      )

      // Top products from items JSONB
      const productMap: Record<string, ProductStat> = {}
      orders.forEach((o: any) => {
        if (!Array.isArray(o.items)) return
        o.items.forEach((item: any) => {
          const key = item.name
          if (!productMap[key]) productMap[key] = { name: key, category: '', total_ordered: 0, revenue: 0 }
          productMap[key].total_ordered += item.qty || 1
          productMap[key].revenue += item.bundle_price ?? (item.unit_price * item.qty) ?? 0
        })
      })
      setTopProducts(
        Object.values(productMap)
          .sort((a, b) => b.total_ordered - a.total_ordered)
          .slice(0, 8)
      )

      setRecentOrders(orders.slice(0, 5))
    }

    // ── Customers ────────────────────────────────────────────
    const { count: custCount } = await supabaseAdmin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sinceISO)
    setActive(custCount || 0)

    // ── Loyalty tier distribution ────────────────────────────
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

    // Conversion rate: delivered / total
    if (orders?.length) {
      const del = orders.filter((o: any) => o.status === 'delivered').length
      setConversion(Math.round((del / orders.length) * 100))
    }

    setLoading(false)
  }

  // ── Mini bar chart ───────────────────────────────────────────
  const maxRevenue = Math.max(...dailyStats.map(d => d.revenue), 1)
  const maxOrders  = Math.max(...dailyStats.map(d => d.orders), 1)
  const maxProd    = Math.max(...topProducts.map(p => p.total_ordered), 1)

  // ─────────────────────────────────────────────────────────────
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

      {loading ? (
        <div className="loading-grid">
          {[...Array(6)].map((_,i) => <div key={i} className="loading-card" />)}
        </div>
      ) : (
        <>
          {/* ── KPI cards ── */}
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

          {/* ── Revenue chart ── */}
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

          {/* ── Bottom row: top products + loyalty ── */}
          <div className="bottom-grid">

            {/* Top products */}
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

            {/* Loyalty tiers */}
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

      <style>{`
        .analytics-page{min-height:100vh;background:#111;color:#fff;font-family:-apple-system,sans-serif;padding-bottom:60px}
        .page-header{display:flex;align-items:center;justify-content:space-between;padding:28px 20px 20px;border-bottom:1px solid #2a2a2a;flex-wrap:wrap;gap:12px}
        .page-eyebrow{font-size:10px;color:#888;letter-spacing:.12em;text-transform:uppercase;margin-bottom:3px}
        .page-title{font-size:22px;font-weight:600}
        .range-tabs{display:flex;gap:6px}
        .rtab{padding:7px 14px;border-radius:8px;border:0.5px solid #2a2a2a;background:transparent;color:#888;font-size:12px;cursor:pointer;transition:all .15s}
        .rtab:hover{color:#fff}
        .rtab.active{background:#CC2222;color:#fff;border-color:#CC2222}

        /* KPI grid */
        .kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;padding:20px}
        .kpi-card{background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:10px;padding:14px}
        .kpi-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
        .kpi-val{font-size:22px;font-weight:600;color:#fff;margin-bottom:4px}
        .kpi-val.revenue{color:#CC2222}
        .kpi-sub{font-size:10px;color:#555}

        /* Loading */
        .loading-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;padding:20px}
        .loading-card{height:90px;background:#1a1a1a;border-radius:10px;animation:pulse 1.5s ease-in-out infinite}
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
        .empty-section{font-size:13px;color:#555;padding:10px 0}

        /* Top products */
        .prod-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:0.5px solid #2a2a2a}
        .prod-row:last-child{border:none}
        .prod-rank{font-size:12px;color:#555;min-width:22px}
        .prod-info{flex:1;min-width:0}
        .prod-name{font-size:12px;color:#ccc;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .prod-bar-wrap{height:3px;background:#2a2a2a;border-radius:2px;overflow:hidden}
        .prod-bar{height:100%;background:#CC2222;border-radius:2px;transition:width .3s ease}
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
      `}</style>
    </div>
  )
}
