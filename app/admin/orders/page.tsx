'use client'
// app/admin/orders/page.tsx
// ─────────────────────────────────────────────────────────────
// Order queue for Distrito Pipa admin.
// See all active orders, move them through the pipeline,
// open pre-filled WhatsApp confirmations per payment mode.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react'
import { adminFetch } from '@/hooks/useAdmin'
import {
  buildConfirmationUrl,
  buildConfirmationText,
  STATUS_LABELS,
  PAYMENT_LABELS,
  DELIVERY_LABELS,
  type OrderForMessage,
} from '@/lib/whatsapp'
import { getVIPStatus, getTierIcon, getTierColor } from '@/lib/clients'
import { getBrandedEmailHtml, renderOrderSummaryHtml } from '@/lib/email-templates'

// ─── Types ────────────────────────────────────────────────────

interface Order {
  id: string
  order_number: string
  payment_link?: string | null
  status: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  items: Array<{
    name: string
    qty: number
    unit_price: number
    color?: string
    bundle_qty?: number
    bundle_price?: number
  }>
  subtotal_mxn: number
  delivery_fee: number
  total_mxn: number
  anticipo_mxn: number
  anticipo_paid: boolean
  full_paid: boolean
  delivery_mode: 'pickup' | 'delivery' | 'punto_medio'
  delivery_zone?: string
  is_night?: boolean
  payment_mode: 'deposit' | 'pickup_cash' | 'full_prepay'
  delivery_address?: string
  scheduled_at?: string
  admin_notes?: string
  created_at: string
  updated_at: string
}

// Status pipeline: what comes next after each status
const NEXT_STATUS: Record<string, string | null> = {
  pending:   'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready:     'delivered',
  delivered: null,
  cancelled: null,
}

const NEXT_LABEL: Record<string, string> = {
  pending:   '✅ Confirmar pedido',
  confirmed: '📦 Marcar preparando',
  preparing: '✅ Marcar listo',
  ready:     '🏁 Marcar entregado',
}

// ─── Main page ────────────────────────────────────────────────

export default function AdminOrdersPage() {
  const [orders, setOrders]           = useState<Order[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<string>('active')
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [preview, setPreview]         = useState<Order | null>(null)
  const [toast, setToast]             = useState<string | null>(null)
  const [updating, setUpdating]       = useState<string | null>(null)

  // ── Load orders ───────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co' || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const mockOrders = JSON.parse(localStorage.getItem('dp_mock_orders') || '[]')
      mockOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setOrders(mockOrders)
      setLoading(false)
      return
    }

    try {
      const res = await adminFetch('/api/admin/orders')
      const json = await res.json()
      if (res.ok && json.orders) setOrders(json.orders as Order[])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Polling fallback since realtime auth is blocked in browser
  useEffect(() => {
    const timer = setInterval(() => {
      load()
    }, 10000)
    return () => clearInterval(timer)
  }, [load])

  // ── Helpers ────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function toMessageOrder(o: Order): OrderForMessage {
    return {
      order_number: o.order_number,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      items: o.items || [],
      subtotal_mxn: o.subtotal_mxn || 0,
      delivery_fee: o.delivery_fee || 0,
      total_mxn: o.total_mxn || 0,
      anticipo_mxn: o.anticipo_mxn || 0,
      delivery_mode: o.delivery_mode,
      delivery_zone: o.delivery_zone,
      is_night: o.is_night,
      payment_mode: o.payment_mode,
      delivery_address: o.delivery_address,
      scheduled_at: o.scheduled_at,
    }
  }

  // ── Actions ────────────────────────────────────────────────
  
  async function performUpdate(id: string, updates: Partial<Order>): Promise<boolean> {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co' || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const mockOrders = JSON.parse(localStorage.getItem('dp_mock_orders') || '[]')
      const updated = mockOrders.map((o: any) => o.id === id ? { ...o, ...updates } : o)
      localStorage.setItem('dp_mock_orders', JSON.stringify(updated))
      return true
    } else {
      try {
        const res = await adminFetch('/api/admin/orders', {
          method: 'PATCH',
          body: JSON.stringify({ id, updates })
        })
        return res.ok
      } catch (e) {
        return false
      }
    }
  }

  async function advanceStatus(order: Order) {
    const next = NEXT_STATUS[order.status]
    if (!next) return

    setUpdating(order.id)
    const success = await performUpdate(order.id, { status: next })

    if (!success) {
      showToast('❌ Error actualizando pedido')
    } else {
      setOrders(os => os.map(o => o.id === order.id ? { ...o, status: next } : o))
      showToast(`✅ ${order.order_number} → ${STATUS_LABELS[next]?.label}`)

      // If confirming: automatically open WhatsApp
      if (order.status === 'pending') {
        const url = buildConfirmationUrl(toMessageOrder({ ...order, status: next }))
        window.open(url, '_blank')
      }
    }
    setUpdating(null)
  }

  async function cancelOrder(order: Order) {
    if (!confirm(`¿Cancelar el pedido ${order.order_number}?`)) return

    setUpdating(order.id)
    await performUpdate(order.id, { status: 'cancelled' })
    setOrders(os => os.map(o => o.id === order.id ? { ...o, status: 'cancelled' } : o))
    setUpdating(null)
    showToast(`🚫 ${order.order_number} cancelado`)
  }

  async function toggleAnticipo(order: Order) {
    const newVal = !order.anticipo_paid
    await performUpdate(order.id, { anticipo_paid: newVal })
    setOrders(os => os.map(o => o.id === order.id ? { ...o, anticipo_paid: newVal } : o))
    showToast(newVal ? '💳 Anticipo marcado como recibido' : '💳 Anticipo desmarcado')
  }

  async function saveNotes(order: Order, notes: string) {
    await performUpdate(order.id, { admin_notes: notes })
    setOrders(os => os.map(o => o.id === order.id ? { ...o, admin_notes: notes } : o))
  }

  async function sendEmailAction(order: Order, type: 'pre_confirm' | 'reminder' | 'confirm' | 'location') {
    if (!order.customer_email) return;
    
    setUpdating(order.id)
    setToast(`Enviando correo...`)
    
    let subject = ''
    let html = ''
    
    if (type === 'pre_confirm') {
      const amountToPay = (order.payment_mode === 'full_prepay' ? order.total_mxn : order.anticipo_mxn).toLocaleString('es-MX')
      subject = `Tu pedido está casi listo 🤝 - Pedido ${order.order_number}`
      const content = `
        <p>¡Qué onda ${order.customer_name}! Gracias por armar tu pedido con Distrito Pipa.</p>
        <p>Para separar tus piezas y agendar la entrega, pedimos un anticipo de <strong>$${amountToPay} MXN</strong>. (Esto nos ayuda a asegurar que el trato es serio y apartar tu mercancía sin broncas).</p>
        <p>El resto lo liquidas al momento de la entrega.</p>
        <p>Aquí te dejo los datos para la transferencia:</p>
        <ul>
          <li><strong>Banco:</strong> BanCoppel</li>
          <li><strong>CLABE:</strong> 167691000009770036</li>
          <li><strong>A nombre de:</strong> Distrito Pipa</li>
          <li><strong>Concepto:</strong> ${order.order_number}</li>
        </ul>
        <p>En cuanto quede, mándanos captura por WhatsApp y nos coordinamos. ¡Seguimos activos!</p>
      `
      html = getBrandedEmailHtml('Instrucciones de Pago', content)
    } else if (type === 'reminder') {
      subject = `¿Sigues por ahí? 👀 - Pedido ${order.order_number}`
      
      let paymentButton = ''
      if (order.payment_link) {
        paymentButton = `
          <div style="margin: 30px 0; text-align: center;">
            <a href="${order.payment_link}" style="background-color: #009EE3; color: white; padding: 14px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
              Pagar de forma segura con Mercado Pago
            </a>
          </div>
          <p style="text-align: center; font-size: 13px; color: #aaa; margin-bottom: 30px;">(Si prefieres transferencia manual, avísanos para mandarte los datos de nuevo)</p>
        `
      }

      const content = `
        <p>¡Qué tal, amigo! Solo paso a recordarte que tenemos tu pedido <strong>${order.order_number}</strong> en pausa.</p>
        <p>Hay buena demanda hoy en Cancún y no queremos que te quedes sin tu pieza. Si todavía la quieres, confírmanos con la captura de tu pago/anticipo.</p>
        
        ${paymentButton}

        <p>Si cambiaste de opinión no hay ningún problema, nada más avísanos para poder liberar los artículos para alguien más.</p>
        <p>¡Quedamos al pendiente!</p>
      `
      html = getBrandedEmailHtml('Recordatorio de Pago', content)
    } else if (type === 'confirm') {
      subject = `¡Pago Confirmado! ✅ - Pedido ${order.order_number}`
      
      let copyBody = ''
      if (order.delivery_mode === 'pickup') {
        if (order.payment_mode === 'full_prepay') {
          copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${order.order_number}</strong> está 100% confirmado y pagado. Cero sorpresas.</p>
                      <p>Tu paquete ya te está esperando. Si ya nos contactaste por WhatsApp, en breve te pasaremos las coordenadas exactas de nuestro spot y nos pondremos de acuerdo para tu recolección.</p>`
        } else {
          copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${order.order_number}</strong> está confirmado gracias a tu anticipo. Cero sorpresas.</p>
                      <p>Tu paquete ya te está esperando; recuerda que <strong>el saldo pendiente se liquida en efectivo al momento de recolectarlo</strong>.</p>
                      <p>Si ya nos contactaste por WhatsApp, en breve te pasaremos las coordenadas exactas de nuestro spot y nos pondremos de acuerdo para tu recolección.</p>
                      <p><em>¿Ocupas cambio? (avísanos con tiempo porfa si necesitas cambio de algún billete)</em></p>`
        }
      } else {
        if (order.payment_mode === 'full_prepay') {
          copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${order.order_number}</strong> está 100% confirmado y pagado. Cero sorpresas.</p>
                      <p>Seguimos moviéndonos por Cancún para entregarte rápido. Si ya nos mandaste tu ubicación por WhatsApp, en breve armamos la ruta y afinamos detalles.</p>`
        } else {
          copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${order.order_number}</strong> está confirmado gracias a tu anticipo. Cero sorpresas.</p>
                      <p>Seguimos moviéndonos por Cancún para entregarte rápido; recuerda que <strong>el saldo pendiente se liquida en efectivo al momento de recibir tus artículos</strong>.</p>
                      <p>Si ya nos mandaste tu ubicación por WhatsApp, en breve armamos la ruta y afinamos detalles.</p>
                      <p><em>¿Ocupas cambio? (avísanos con tiempo porfa si necesitas cambio de algún billete)</em></p>`
        }
      }

      let items = []
      try {
        items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || [])
      } catch (e) {
        items = []
      }

      const anticipoPaid = order.payment_mode === 'full_prepay' ? order.total_mxn : (order.delivery_mode === 'pickup' ? 0 : 50)
      
      const orderSummaryHtml = renderOrderSummaryHtml({
        items: items.map((item: any) => ({
          name: item.name,
          title: item.title,
          quantity: item.qty || item.quantity || 1,
          price: item.unit_price || item.price || 0
        })),
        subtotal: order.subtotal_mxn || 0,
        deliveryFee: order.delivery_fee || 0,
        total: order.total_mxn || 0,
        anticipoPaid
      })

      const content = `
        <p>¡Listo ${order.customer_name.split(' ')[0]}! Ya nos cayó tu pago. Gracias por la confianza.</p>
        ${copyBody}
        ${orderSummaryHtml}
        <p>Mientras empaquetamos tus cosas en nuestra bolsa Kraft, siéntete libre de ver lo que andan armando tus vecinos en nuestro Instagram.</p>
        <p>¡Aquí andamos para cualquier cosa!</p>
      `
      html = getBrandedEmailHtml('Pago Recibido', content)
    } else if (type === 'location') {
      subject = `Coordenadas para tu entrega 📍 - Pedido ${order.order_number}`
      const content = `
        <p>¡Qué onda ${order.customer_name}! Todo listo para entregarte tu paquete.</p>
        <p>Nos vemos en nuestra zona de entregas en la Región 96:</p>
        <p>📍 <strong>Punto Acordado (Ej. Coppel Nichupté)</strong></p>
        <p>Recuerda tener a la mano el resto de tu pago en efectivo y estar puntual. Nos vemos pronto.</p>
        <p>Si tienes algún contratiempo o vas a llegar tarde, tiranos un mensaje por WhatsApp con anticipación para no cruzarnos. ¡Ahí nos vemos!</p>
      `
      html = getBrandedEmailHtml('Ubicación de Pick Up', content)
    }

    try {
      const res = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: order.customer_email, subject, html })
      })
      if (res.ok) {
        showToast('✅ Correo enviado con éxito')
      } else {
        showToast('❌ Error al enviar correo')
      }
    } catch(e) {
      showToast('❌ Error de conexión')
    }
    setUpdating(null)
  }

  // ── Filter ─────────────────────────────────────────────────

  const filtered = orders.filter(o => {
    if (filter === 'active')    return !['delivered','cancelled'].includes(o.status)
    if (filter === 'pending')   return o.status === 'pending'
    if (filter === 'delivered') return o.status === 'delivered'
    if (filter === 'cancelled') return o.status === 'cancelled'
    return true
  })

  const counts = {
    active:    orders.filter(o => !['delivered','cancelled'].includes(o.status)).length,
    pending:   orders.filter(o => o.status === 'pending').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    total:     orders.length,
  }

  // ── Revenue today ──────────────────────────────────────────
  const today = new Date().toDateString()
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today)
  const todayRevenue = todayOrders
    .filter(o => o.status === 'delivered')
    .reduce((s, o) => s + o.total_mxn, 0)
  const depositsPending = orders.filter(o =>
    o.payment_mode !== 'pickup_cash' && !o.anticipo_paid && !['delivered','cancelled'].includes(o.status)
  ).length

  // ── Calculate VIP status per phone ─────────────────────────
  const vipByPhone = useMemo(() => {
    const totals: Record<string, number> = {}
    orders.forEach(o => {
      if (o.status !== 'cancelled') {
        const cp = o.customer_phone || ''
        const phone = cp.replace(/\D/g, '') || cp
        totals[phone] = (totals[phone] || 0) + (o.total_mxn || 0)
      }
    })
    const vip: Record<string, ReturnType<typeof getVIPStatus>> = {}
    for (const phone in totals) {
      vip[phone] = getVIPStatus(totals[phone])
    }
    return vip
  }, [orders])

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="orders-page">

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* WhatsApp preview modal */}
      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="preview-modal" onClick={e => e.stopPropagation()}>
            <div className="preview-header">
              <div>
                <div className="preview-title">Vista previa del mensaje</div>
                <div className="preview-sub">
                  {PAYMENT_LABELS[preview.payment_mode]} · {preview.order_number}
                </div>
              </div>
              <button className="close-btn" onClick={() => setPreview(null)}>✕</button>
            </div>

            <div className="preview-body">
              <pre className="message-text">{buildConfirmationText(toMessageOrder(preview))}</pre>
            </div>

            <div className="preview-footer">
              <button
                className="btn-ghost"
                onClick={() => {
                  navigator.clipboard.writeText(buildConfirmationText(toMessageOrder(preview)))
                  showToast('📋 Mensaje copiado')
                }}
              >
                📋 Copiar mensaje
              </button>
              <a
                className="btn-whatsapp"
                href={buildConfirmationUrl(toMessageOrder(preview))}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPreview(null)}
              >
                💬 Abrir en WhatsApp →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Gestión de ventas</div>
          <h1 className="page-title">Pedidos</h1>
        </div>
        <button className="btn-ghost" onClick={load}>↺ Actualizar</button>
      </div>

      {/* ── STATS ── */}
      <div className="stats-row">
        <div className="stat">
          <div className="stat-val" style={{ color: '#fbbf24' }}>{counts.pending}</div>
          <div className="stat-label">Pendientes</div>
        </div>
        <div className="stat">
          <div className="stat-val" style={{ color: '#60a5fa' }}>{counts.active}</div>
          <div className="stat-label">Activos</div>
        </div>
        <div className="stat">
          <div className="stat-val" style={{ color: '#4ade80' }}>{counts.delivered}</div>
          <div className="stat-label">Entregados</div>
        </div>
        <div className="stat">
          <div className="stat-val" style={{ color: '#CC2222' }}>
            ${todayRevenue.toLocaleString('es-MX')}
          </div>
          <div className="stat-label">Hoy</div>
        </div>
        {depositsPending > 0 && (
          <div className="stat deposit-alert">
            <div className="stat-val" style={{ color: '#fb923c' }}>{depositsPending}</div>
            <div className="stat-label">Sin anticipo</div>
          </div>
        )}
      </div>

      {/* ── FILTERS ── */}
      <div className="filters">
        {[
          { key: 'active',    label: `Activos (${counts.active})` },
          { key: 'pending',   label: `Pendientes (${counts.pending})` },
          { key: 'delivered', label: `Entregados (${counts.delivered})` },
          { key: 'all',       label: `Todos (${counts.total})` },
        ].map(f => (
          <button
            key={f.key}
            className={`filter-tab ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── ORDER LIST ── */}
      <div className="order-list">
        {loading && <div className="loading">Cargando pedidos...</div>}
        {!loading && filtered.length === 0 && (
          <div className="empty">No hay pedidos en esta vista.</div>
        )}

        {filtered.map(order => {
          const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: '#888' }
          const isExpanded = expanded === order.id
          const isUpdating = updating === order.id
          const nextStatus = NEXT_STATUS[order.status]
          const needsDeposit = order.payment_mode !== 'pickup_cash' && !order.anticipo_paid

          return (
            <div
              key={order.id}
              className={`order-card ${order.status === 'cancelled' ? 'cancelled' : ''}`}
            >
              {/* ── Card header ── */}
              <div className="card-head" onClick={() => setExpanded(isExpanded ? null : order.id)}>
                <div className="head-left">
                  {/* Status pill */}
                  <span
                    className="status-pill"
                    style={{ background: `${statusInfo.color}22`, color: statusInfo.color, borderColor: `${statusInfo.color}44` }}
                  >
                    {statusInfo.label}
                  </span>

                  {/* Order number */}
                  <span className="order-num">{order.order_number}</span>

                  {/* Deposit alert */}
                  {needsDeposit && (
                    <span className="deposit-chip">⚠️ Sin anticipo</span>
                  )}
                </div>

                <div className="head-right">
                  <span className="order-total">${(order.total_mxn || 0).toLocaleString('es-MX')}</span>
                  <span className="expand-icon">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* ── Summary row (always visible) ── */}
              <div className="card-summary">
                <span className="summary-name">{order.customer_name}</span>
                {(() => {
                  const cp = order.customer_phone || ''
                  const phone = cp.replace(/\D/g, '') || cp
                  const vip = vipByPhone[phone]
                  if (vip && vip.tier !== 'Ninguno') {
                    const color = getTierColor(vip.tier)
                    return (
                      <span style={{ fontSize: '10px', fontWeight: 600, color: color, background: `${color}11`, padding: '2px 6px', borderRadius: '10px', border: `1px solid ${color}44`, marginLeft: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        {getTierIcon(vip.tier)} {vip.tier}
                      </span>
                    )
                  }
                  return null
                })()}
                <span className="summary-sep">·</span>
                {order.status === 'wholesale_inquiry' ? (
                  <span className="summary-mode" style={{ color: '#f59e0b' }}>Cotización de Mayoreo</span>
                ) : (
                  <>
                    <span className="summary-mode">{DELIVERY_LABELS[order.delivery_mode] || '—'}</span>
                    <span className="summary-sep">·</span>
                    <span className="summary-pay">{PAYMENT_LABELS[order.payment_mode] || '—'}</span>
                  </>
                )}
                <span className="summary-sep">·</span>
                <span className="summary-date">
                  {new Date(order.created_at).toLocaleString('es-MX', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>

              {/* ── Expanded detail ── */}
              {isExpanded && (
                <div className="card-detail">
                  <div className="detail-grid">

                    {/* Items */}
                    <div className="detail-section">
                      <div className="detail-section-title">
                        {order.status === 'wholesale_inquiry' ? 'Detalles de Solicitud' : 'Productos'}
                      </div>
                      
                      {order.status === 'wholesale_inquiry' ? (
                        <div className="admin-notes">
                          {(order.admin_notes || '').split('\n').map((line, idx) => (
                            <p key={idx}>{line}</p>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="items-list">
                            {(order.items || []).map((item, i) => (
                              <div key={i} className="item-row">
                                <span className="item-qty">{item.qty}x</span>
                                <span className="item-name">
                                  {item.name}
                                  {item.color ? ` — ${item.color}` : ''}
                                  {item.bundle_qty ? ` (pack ${item.bundle_qty}x)` : ''}
                                </span>
                                <span className="item-price">
                                  ${(item.bundle_price ?? item.unit_price * item.qty).toLocaleString('es-MX')}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="price-summary">
                            <div className="price-row">
                              <span>Subtotal</span>
                              <span>${(order.subtotal_mxn || 0).toLocaleString('es-MX')}</span>
                            </div>
                        {(order.delivery_fee || 0) > 0 && (
                          <div className="price-row">
                            <span>Envío</span>
                            <span>${(order.delivery_fee || 0).toLocaleString('es-MX')}</span>
                          </div>
                        )}
                        <div className="price-row total-row">
                          <span>TOTAL</span>
                          <span>${(order.total_mxn || 0).toLocaleString('es-MX')}</span>
                        </div>
                        {(order.anticipo_mxn || 0) > 0 && (
                          <div className="price-row anticipo-row">
                            <span>Anticipo requerido</span>
                            <span>${(order.anticipo_mxn || 0).toLocaleString('es-MX')}</span>
                          </div>
                        )}
                      </div>
                    </>)}
                  </div>

                    {/* Customer + delivery */}
                    <div className="detail-section">
                      <div className="detail-section-title">Cliente y entrega</div>
                      <div className="info-rows">
                        <div className="info-row">
                          <span className="info-label">Nombre</span>
                          <span className="info-value">{order.customer_name}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">WhatsApp</span>
                          <a
                            href={`https://wa.me/${(order.customer_phone || '').replace(/\D/g,'')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="info-link"
                          >
                            {order.customer_phone || 'Sin teléfono'}
                          </a>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Entrega</span>
                          <span className="info-value">{DELIVERY_LABELS[order.delivery_mode]}</span>
                        </div>
                        {order.delivery_address && (
                          <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span className="info-label" style={{ marginBottom: '8px' }}>Dirección de Entrega</span>
                            <div style={{
                              background: '#1a1a1a',
                              border: '1px solid #333',
                              padding: '12px',
                              borderRadius: '8px',
                              width: '100%',
                              color: '#fff',
                              whiteSpace: 'pre-wrap',
                              userSelect: 'all',
                              fontSize: '14px',
                              lineHeight: '1.5'
                            }}>
                              {order.delivery_address}
                            </div>
                          </div>
                        )}
                        {order.scheduled_at && (
                          <div className="info-row">
                            <span className="info-label">Horario</span>
                            <span className="info-value">
                              {new Date(order.scheduled_at).toLocaleString('es-MX', {
                                weekday: 'long', day: 'numeric', month: 'long',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                        )}
                        <div className="info-row">
                          <span className="info-label">Pago</span>
                          <span className="info-value">{PAYMENT_LABELS[order.payment_mode]}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Deposit toggle */}
                  {order.payment_mode !== 'pickup_cash' && (order.anticipo_mxn || 0) > 0 && (
                    <div className="anticipo-bar">
                      <div className="anticipo-info">
                        <span className="anticipo-label">Anticipo ${(order.anticipo_mxn || 0).toLocaleString('es-MX')} MXN</span>
                        <span className={`anticipo-status ${order.anticipo_paid ? 'paid' : 'unpaid'}`}>
                          {order.anticipo_paid ? '✓ Recibido' : '⏳ Pendiente'}
                        </span>
                      </div>
                      <button
                        className={`anticipo-toggle ${order.anticipo_paid ? 'mark-unpaid' : 'mark-paid'}`}
                        onClick={() => toggleAnticipo(order)}
                      >
                        {order.anticipo_paid ? 'Desmarcar recibido' : '✓ Marcar anticipo recibido'}
                      </button>
                    </div>
                  )}

                  {/* Admin notes */}
                  <div className="notes-section">
                    <label className="notes-label">Notas internas (solo tú las ves)</label>
                    <textarea
                      className="notes-input"
                      defaultValue={order.admin_notes || ''}
                      placeholder="Ej: cliente pidió empaque extra, acordamos entrega 6pm..."
                      rows={2}
                      onBlur={e => saveNotes(order, e.target.value)}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="card-actions">
                    {/* WhatsApp preview */}
                    <button
                      className="btn-wa-preview"
                      onClick={() => setPreview(order)}
                    >
                      👁 Ver mensaje
                    </button>

                    {/* Send WhatsApp (opens directly) */}
                    <a
                      className="btn-whatsapp-sm"
                      href={buildConfirmationUrl(toMessageOrder(order))}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      💬 Abrir WhatsApp
                    </a>

                    {/* Advance pipeline */}
                    {nextStatus && (
                      <button
                        className="btn-advance"
                        onClick={() => advanceStatus(order)}
                        disabled={isUpdating}
                      >
                        {isUpdating ? '...' : NEXT_LABEL[order.status]}
                      </button>
                    )}

                    {/* Cancel */}
                    {!['delivered','cancelled'].includes(order.status) && (
                      <button
                        className="btn-cancel"
                        onClick={() => cancelOrder(order)}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>

                  {/* Email Actions Panel */}
                  {order.customer_email && (
                    <div className="email-actions">
                      <div className="email-title">📧 Correos Operativos: {order.customer_email}</div>
                      <div className="email-btn-group">
                        {order.status === 'pending' && <button className="btn-email" onClick={() => sendEmailAction(order, 'pre_confirm')}>Enviar Pre-confirmación</button>}
                        {(!order.anticipo_paid && order.payment_mode !== 'pickup_cash') && <button className="btn-email" onClick={() => sendEmailAction(order, 'reminder')}>Recordatorio de Pago</button>}
                        {order.status === 'confirmed' && <button className="btn-email" onClick={() => sendEmailAction(order, 'confirm')}>Confirmación de Pago</button>}
                        {(order.status === 'ready' && order.delivery_mode === 'pickup') && <button className="btn-email" onClick={() => sendEmailAction(order, 'location')}>Enviar Ubicación Pick Up</button>}
                        {/* Fallback button if no logical button applies right now */}
                        {!(order.status === 'pending' || (!order.anticipo_paid && order.payment_mode !== 'pickup_cash') || order.status === 'confirmed' || (order.status === 'ready' && order.delivery_mode === 'pickup')) && (
                           <span style={{fontSize: '11px', color: '#666'}}>No hay correos operativos sugeridos para el estado actual.</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <style>{`
        .orders-page {
          min-height: 100vh;
          background: #111;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding-bottom: 80px;
        }

        /* Toast */
        .toast {
          position: fixed; top: 16px; right: 16px; z-index: 1000;
          background: #1a1a1a; border: 1px solid #2a2a2a;
          color: #fff; padding: 10px 18px; border-radius: 8px;
          font-size: 13px; box-shadow: 0 4px 20px rgba(0,0,0,.5);
          animation: slideIn .2s ease;
        }
        @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:none} }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.7);
          display: flex; align-items: flex-end; justify-content: center;
          z-index: 999; padding: 0;
        }
        .preview-modal {
          background: #1a1a1a; border: 1px solid #2a2a2a;
          border-radius: 16px 16px 0 0; width: 100%; max-width: 560px;
          max-height: 85vh; display: flex; flex-direction: column;
        }
        .preview-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 18px 20px 14px; border-bottom: 1px solid #2a2a2a; flex-shrink: 0;
        }
        .preview-title { font-size: 15px; font-weight: 600; margin-bottom: 3px; }
        .preview-sub { font-size: 12px; color: #888; }
        .close-btn { background: none; border: none; color: #888; font-size: 18px; cursor: pointer; padding: 4px; }
        .preview-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
        .message-text {
          font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.6;
          color: #ccc; white-space: pre-wrap; word-break: break-word;
          background: #111; border-radius: 8px; padding: 14px;
        }
        .preview-footer {
          display: flex; gap: 10px; padding: 14px 20px;
          border-top: 1px solid #2a2a2a; flex-shrink: 0;
        }

        /* Page header */
        .page-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 28px 20px 20px; border-bottom: 1px solid #2a2a2a;
        }
        .page-eyebrow { font-size: 10px; color: #888; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 3px; }
        .page-title { font-size: 22px; font-weight: 600; }

        /* Stats */
        .stats-row { display: flex; gap: 8px; padding: 16px 20px; flex-wrap: wrap; }
        .stat {
          background: #1a1a1a; border: 0.5px solid #2a2a2a; border-radius: 8px;
          padding: 10px 14px; text-align: center; min-width: 64px;
        }
        .stat.deposit-alert { border-color: #fb923c44; background: rgba(251,146,60,.05); }
        .stat-val { font-size: 20px; font-weight: 600; }
        .stat-label { font-size: 9px; color: #888; text-transform: uppercase; margin-top: 2px; }

        /* Filters */
        .filters { display: flex; gap: 8px; padding: 0 20px 16px; flex-wrap: wrap; }
        .filter-tab {
          padding: 6px 14px; border-radius: 20px; border: 0.5px solid #2a2a2a;
          background: transparent; color: #888; font-size: 12px; cursor: pointer; transition: all .15s;
        }
        .filter-tab:hover { color: #fff; }
        .filter-tab.active { background: #CC2222; color: #fff; border-color: #CC2222; }

        /* Order list */
        .order-list { display: flex; flex-direction: column; gap: 8px; padding: 0 20px; }
        .loading, .empty { padding: 40px; text-align: center; color: #888; font-size: 14px; }

        /* Order card */
        .order-card {
          background: #1a1a1a; border: 0.5px solid #2a2a2a; border-radius: 10px; overflow: hidden;
          transition: border-color .15s;
        }
        .order-card:hover { border-color: #3a3a3a; }
        .order-card.cancelled { opacity: 0.5; }

        /* Card head */
        .card-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 14px 8px; cursor: pointer; user-select: none;
        }
        .head-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .head-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

        .status-pill {
          font-size: 10px; font-weight: 500; padding: 3px 10px; border-radius: 12px;
          border: 1px solid; letter-spacing: .03em;
        }
        .order-num { font-size: 13px; font-weight: 600; color: #fff; }
        .deposit-chip {
          font-size: 10px; background: rgba(251,146,60,.15); color: #fb923c;
          border: 1px solid rgba(251,146,60,.3); padding: 2px 8px; border-radius: 10px;
        }
        .order-total { font-size: 15px; font-weight: 600; color: #CC2222; }
        .expand-icon { font-size: 10px; color: #555; }

        /* Card summary */
        .card-summary {
          display: flex; align-items: center; gap: 6px; padding: 0 14px 10px;
          font-size: 11px; color: #888; flex-wrap: wrap;
        }
        .summary-sep { color: #2a2a2a; }
        .summary-name { color: #ccc; font-weight: 500; }
        .summary-mode, .summary-pay { color: #888; }

        /* Card detail */
        .card-detail {
          padding: 14px; border-top: 1px solid #2a2a2a;
          display: flex; flex-direction: column; gap: 14px;
        }
        .detail-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 640px) { .detail-grid { grid-template-columns: 1fr 1fr; } }

        .detail-section { background: #111; border-radius: 8px; padding: 12px; }
        .detail-section-title { font-size: 10px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 10px; }

        /* Items */
        .items-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
        .item-row { display: flex; align-items: baseline; gap: 6px; font-size: 12px; }
        .item-qty { color: #888; flex-shrink: 0; min-width: 20px; }
        .item-name { flex: 1; color: #ccc; }
        .item-price { color: #CC2222; font-weight: 500; flex-shrink: 0; }

        .price-summary { border-top: 1px solid #2a2a2a; padding-top: 8px; display: flex; flex-direction: column; gap: 4px; }
        .price-row { display: flex; justify-content: space-between; font-size: 12px; color: #888; }
        .total-row { color: #fff; font-weight: 600; font-size: 13px; border-top: 1px solid #2a2a2a; padding-top: 6px; margin-top: 2px; }
        .anticipo-row { color: #fb923c; }

        /* Info rows */
        .info-rows { display: flex; flex-direction: column; gap: 8px; }
        .info-row { display: flex; flex-direction: column; gap: 2px; }
        .info-label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: .05em; }
        .info-value { font-size: 13px; color: #ccc; }
        .info-link { font-size: 13px; color: #4ade80; text-decoration: none; }
        .info-link:hover { text-decoration: underline; }

        /* Anticipo bar */
        .anticipo-bar {
          background: #111; border: 0.5px solid #2a2a2a; border-radius: 8px;
          padding: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px;
          flex-wrap: wrap;
        }
        .anticipo-info { display: flex; flex-direction: column; gap: 3px; }
        .anticipo-label { font-size: 13px; font-weight: 500; color: #fff; }
        .anticipo-status { font-size: 11px; }
        .anticipo-status.paid { color: #4ade80; }
        .anticipo-status.unpaid { color: #fb923c; }
        .anticipo-toggle {
          padding: 7px 14px; border-radius: 7px; font-size: 12px;
          font-weight: 500; cursor: pointer; border: 1px solid; transition: all .15s;
        }
        .mark-paid { background: rgba(74,222,128,.1); color: #4ade80; border-color: rgba(74,222,128,.3); }
        .mark-paid:hover { background: rgba(74,222,128,.2); }

        .email-actions { margin-top: 14px; padding: 12px; background: rgba(79, 70, 229, 0.05); border: 1px solid rgba(79, 70, 229, 0.2); border-radius: 8px; }
        .email-title { font-size: 11px; font-weight: 600; color: #a5b4fc; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        .email-btn-group { display: flex; gap: 8px; flex-wrap: wrap; }
        .btn-email { padding: 8px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; background: #4f46e5; color: white; border: none; cursor: pointer; transition: background 0.2s; }
        .btn-email:hover { background: #4338ca; }
        .btn-email:disabled { opacity: 0.5; cursor: not-allowed; }
        .mark-unpaid { background: rgba(248,113,113,.1); color: #f87171; border-color: rgba(248,113,113,.3); }

        /* Notes */
        .notes-section { display: flex; flex-direction: column; gap: 6px; }
        .notes-label { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: .05em; }
        .notes-input {
          background: #111; border: 0.5px solid #2a2a2a; border-radius: 6px;
          color: #ccc; padding: 8px 10px; font-size: 12px; font-family: inherit; resize: vertical;
        }
        .notes-input:focus { outline: none; border-color: #CC2222; }

        /* Action buttons */
        .card-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

        .btn-wa-preview {
          padding: 8px 14px; border-radius: 7px; font-size: 12px; font-weight: 500;
          cursor: pointer; border: 0.5px solid #2a2a2a; background: #1a1a1a; color: #888;
          transition: all .15s;
        }
        .btn-wa-preview:hover { color: #fff; border-color: #555; }

        .btn-whatsapp-sm, .btn-whatsapp {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 7px; font-size: 12px; font-weight: 600;
          background: #25D366; color: #fff; text-decoration: none; border: none; cursor: pointer;
          transition: background .15s;
        }
        .btn-whatsapp-sm:hover, .btn-whatsapp:hover { background: #22c35c; }

        .btn-advance {
          padding: 8px 16px; border-radius: 7px; font-size: 12px; font-weight: 600;
          background: #CC2222; color: #fff; border: none; cursor: pointer; margin-left: auto;
          transition: background .15s;
        }
        .btn-advance:hover:not(:disabled) { background: #e02222; }
        .btn-advance:disabled { opacity: .5; cursor: not-allowed; }

        .btn-cancel {
          padding: 8px 14px; border-radius: 7px; font-size: 12px; cursor: pointer;
          background: transparent; color: #f87171; border: 0.5px solid rgba(248,113,113,.3);
          transition: all .15s;
        }
        .btn-cancel:hover { background: rgba(248,113,113,.1); }

        .btn-ghost {
          padding: 8px 14px; border-radius: 7px; font-size: 12px; cursor: pointer;
          background: transparent; color: #888; border: 0.5px solid #2a2a2a; transition: all .15s;
        }
        .btn-ghost:hover { color: #fff; }
      `}</style>
    </div>
  )
}
