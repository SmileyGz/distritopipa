'use client'
// app/admin/orders/page.tsx
// ─────────────────────────────────────────────────────────────
// Distrito Pipa Cancún — Gestión de Pedidos & Despacho
// Alineado al Brand Board: Rojo Eléctrico (#DC143C), Negro Carbón (#1A1A1A), Bebas Neue + Inter
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react'
import { adminFetch } from '@/hooks/useAdmin'
import {
  buildConfirmationUrl,
  buildConfirmationText,
  buildCancellationUrl,
  buildCancellationText,
  STATUS_LABELS,
  PAYMENT_LABELS,
  DELIVERY_LABELS,
  type OrderForMessage,
} from '@/lib/whatsapp'
import { getVIPStatus, getTierIcon, getTierColor } from '@/lib/clients'
import { getBrandedEmailHtml, renderOrderSummaryHtml, renderCancellationEmailHtml } from '@/lib/email-templates'
import { BANK_CONFIG } from '@/lib/config'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────

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
  payment_link?: string | null
  status: string
  customer_id?: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  items: OrderItem[]
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
  customer_notes?: string
  delivery_notes?: string
  scheduled_at?: string
  admin_notes?: string
  created_at: string
  updated_at: string
}

type FilterKey = 'active' | 'pending' | 'no_deposit' | 'preparing' | 'delivery' | 'pickup' | 'delivered' | 'cancelled' | 'all'
type SortKey = 'recent' | 'total_desc' | 'deposit_pending' | 'delivery_first' | 'pickup_first'

// Status pipeline progression
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
  preparing: '🏁 Marcar listo',
  ready:     '🎉 Marcar entregado',
}

// ─── Helpers ──────────────────────────────────────────────────

function buildDispatchDossier(order: Order): string {
  const cleanPhone = (order.customer_phone || '').replace(/\D/g, '')
  const items = (order.items || []).map(i => {
    const color = i.color ? ` (${i.color})` : ''
    const bundle = i.bundle_qty ? ` [Pack ${i.bundle_qty}x]` : ''
    const price = (i.bundle_price ?? i.unit_price * i.qty).toLocaleString('es-MX')
    return `  • ${i.qty}x ${i.name}${color}${bundle} — $${price} MXN`
  }).join('\n')

  let saldo = order.total_mxn || 0
  if (order.payment_mode === 'full_prepay') {
    saldo = 0
  } else if (order.anticipo_paid) {
    saldo = Math.max(0, (order.total_mxn || 0) - (order.anticipo_mxn || 50))
  }

  const modo = order.delivery_mode === 'pickup'
    ? '📍 RECOLECCIÓN: Región 96 (Soriana / Coppel Nichupté)'
    : `🛵 DOMICILIO: ${order.delivery_address || 'Dirección a confirmar'}`

  const lines = [
    `📍 FICHA DE DESPACHO — DISTRITO PIPA CANCÚN`,
    `📦 Folio: #${order.order_number}`,
    `👤 Cliente: ${order.customer_name}`,
    `📱 Teléfono: ${cleanPhone}`,
    modo,
    order.scheduled_at ? `🕒 Horario: ${new Date(order.scheduled_at).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : null,
    order.is_night ? `🌙 Horario: Entrega Nocturna (+8 PM)` : null,
    `🛍️ Artículos:`,
    items,
    `💰 Total Pedido: $${(order.total_mxn || 0).toLocaleString('es-MX')} MXN${order.delivery_fee ? ` (incluye $${order.delivery_fee} de envío)` : ''}`,
    order.payment_mode === 'full_prepay'
      ? `💳 Pago: 100% LIQUIDADO (NO COBRAR NADA EN LA ENTREGA)`
      : `💳 Anticipo: $${(order.anticipo_mxn || 50).toLocaleString('es-MX')} MXN (${order.anticipo_paid ? '✓ PAGADO' : '⏳ PENDIENTE'})`,
    order.payment_mode !== 'full_prepay'
      ? `💵 COBRAR EN EFECTIVO AL ENTREGAR: $${saldo.toLocaleString('es-MX')} MXN`
      : null,
    (order.customer_notes || order.delivery_notes) ? `💬 NOTAS DEL CLIENTE: ${order.customer_notes || order.delivery_notes}` : null,
    order.admin_notes ? `📝 Notas internas: ${order.admin_notes}` : null,
  ].filter(Boolean)

  return lines.join('\n')
}

function getCashOnDelivery(order: Order): { label: string; amount: number; isPaid: boolean } {
  if (order.status === 'cancelled') return { label: 'Cancelado', amount: 0, isPaid: true }
  if (order.payment_mode === 'full_prepay') {
    if (order.full_paid || order.status === 'confirmed' || order.status === 'ready' || order.status === 'delivered') {
      return { label: '✓ Liquidado 100%', amount: 0, isPaid: true }
    }
    return { label: '⏳ Pago Completo Pendiente', amount: order.total_mxn || 0, isPaid: false }
  }
  if (order.anticipo_paid) {
    const balance = Math.max(0, (order.total_mxn || 0) - (order.anticipo_mxn || 50))
    return {
      label: balance > 0 ? `💵 Cobrar en mano: $${balance.toLocaleString('es-MX')} MXN` : '✓ Liquidado 100%',
      amount: balance,
      isPaid: balance === 0,
    }
  }
  return {
    label: `⚠️ Cobrar total: $${(order.total_mxn || 0).toLocaleString('es-MX')} MXN (Sin anticipo)`,
    amount: order.total_mxn || 0,
    isPaid: false,
  }
}

function getGoogleMapsUrl(address: string): string {
  const query = address.toLowerCase().includes('cancún') || address.toLowerCase().includes('cancun')
    ? address
    : `${address}, Cancún, Quintana Roo`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
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

// ─── Main Component ───────────────────────────────────────────

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<FilterKey>('active')
  const [sortField, setSortField] = useState<SortKey>('recent')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [preview, setPreview] = useState<Order | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null)
  const [cancelReason, setCancelReason] = useState<string>('Falta de anticipo (tiempo límite expirado)')
  const [cancelNotifyEmail, setCancelNotifyEmail] = useState<boolean>(true)

  // ── Create Order Modal State ──
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [catalogProducts, setCatalogProducts] = useState<Array<{ id: string; name_es: string; price_mxn: number; colors?: string[]; category?: string }>>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createdOrderSuccess, setCreatedOrderSuccess] = useState<Order | null>(null)

  // Form fields
  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [custEmail, setCustEmail] = useState('')
  const [delivMode, setDelivMode] = useState<'pickup' | 'delivery' | 'punto_medio'>('delivery')
  const [delivZone, setDelivZone] = useState<'zone1' | 'zone2'>('zone1')
  const [isNight, setIsNight] = useState(false)
  const [delivAddress, setDelivAddress] = useState('')
  const [delivNotes, setDelivNotes] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [payMode, setPayMode] = useState<'deposit' | 'pickup_cash' | 'full_prepay'>('deposit')
  const [anticipoPaid, setAnticipoPaid] = useState(false)
  const [initialStatus, setInitialStatus] = useState('confirmed')
  const [sendEmailNotify, setSendEmailNotify] = useState(false)
  const [customDeliveryFee, setCustomDeliveryFee] = useState<string>('')
  const [customAnticipo, setCustomAnticipo] = useState<string>('')
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])

  const resetCreateForm = () => {
    setCustName('')
    setCustPhone('')
    setCustEmail('')
    setDelivMode('delivery')
    setDelivZone('zone1')
    setIsNight(false)
    setDelivAddress('')
    setDelivNotes('')
    setAdminNotes('')
    setPayMode('deposit')
    setAnticipoPaid(false)
    setInitialStatus('confirmed')
    setSendEmailNotify(false)
    setCustomDeliveryFee('')
    setCustomAnticipo('')
    setOrderItems([])
    setCreatedOrderSuccess(null)
  }

  const openCreateModal = async () => {
    resetCreateForm()
    setIsCreateOpen(true)
    if (catalogProducts.length === 0) {
      setLoadingProducts(true)
      try {
        const res = await fetch('/api/products')
        const json = await res.json()
        if (json.products) setCatalogProducts(json.products)
      } catch (e) {
        console.error('Failed to load products for manual order', e)
      }
      setLoadingProducts(false)
    }
  }

  const calcSubtotal = useMemo(() => {
    return orderItems.reduce((acc, it) => acc + (it.bundle_price !== undefined && it.bundle_price > 0 ? it.bundle_price : it.unit_price * (it.qty || 1)), 0)
  }, [orderItems])

  const calcDeliveryFee = useMemo(() => {
    if (customDeliveryFee !== '') {
      return Number(customDeliveryFee) || 0
    }
    if (delivMode === 'pickup') return 0
    if (delivZone === 'zone2') return isNight ? 100 : 80
    if (delivZone === 'zone1') return isNight ? 80 : 50
    return 0
  }, [customDeliveryFee, delivMode, delivZone, isNight])

  const calcTotal = useMemo(() => {
    return calcSubtotal + calcDeliveryFee
  }, [calcSubtotal, calcDeliveryFee])

  const calcAnticipo = useMemo(() => {
    if (customAnticipo !== '') {
      return Number(customAnticipo) || 0
    }
    if (payMode === 'full_prepay') return calcTotal
    if (delivMode === 'pickup') return 0
    return 50
  }, [customAnticipo, payMode, delivMode, calcTotal])

  const calcSaldoEntrega = useMemo(() => {
    if (payMode === 'full_prepay') return 0
    if (anticipoPaid) return Math.max(0, calcTotal - calcAnticipo)
    return calcTotal
  }, [payMode, anticipoPaid, calcTotal, calcAnticipo])

  const handleSelectProduct = (productId: string) => {
    if (!productId) return
    const prod = catalogProducts.find(p => p.id === productId)
    if (!prod) return
    setOrderItems(prev => [
      ...prev,
      {
        name: prod.name_es,
        qty: 1,
        unit_price: prod.price_mxn,
        color: prod.colors && prod.colors.length > 0 ? prod.colors[0] : undefined,
      }
    ])
  }

  const handleAddCustomItem = () => {
    setOrderItems(prev => [
      ...prev,
      {
        name: '',
        qty: 1,
        unit_price: 0,
      }
    ])
  }

  const handleUpdateItem = (idx: number, field: keyof OrderItem, val: any) => {
    setOrderItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: val }
      return next
    })
  }

  const handleRemoveItem = (idx: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== idx))
  }

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!custName.trim()) {
      toast.error('Ingresa el nombre del cliente')
      return
    }
    if (!custPhone.trim() || custPhone.trim().length < 10) {
      toast.error('Ingresa un teléfono WhatsApp válido (10 dígitos)')
      return
    }
    if (orderItems.length === 0) {
      toast.error('Agrega al menos un artículo al pedido')
      return
    }
    for (const item of orderItems) {
      if (!item.name.trim()) {
        toast.error('Todos los artículos deben tener un nombre')
        return
      }
      if (!item.qty || item.qty < 1) {
        toast.error('La cantidad mínima por artículo es 1')
        return
      }
    }
    if (delivMode === 'delivery' && !delivAddress.trim()) {
      toast.error('Ingresa la dirección de entrega a domicilio')
      return
    }

    setCreateSubmitting(true)

    // Fallback for local testing if Supabase is dummy
    if (process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co' || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const mockOrders = JSON.parse(localStorage.getItem('dp_mock_orders') || '[]')
      const fakeOrder: Order = {
        id: 'order-' + Date.now(),
        order_number: 'DP-' + Math.floor(1000 + Math.random() * 9000),
        status: initialStatus,
        customer_name: custName.trim(),
        customer_phone: custPhone.trim(),
        customer_email: custEmail.trim() || undefined,
        items: orderItems,
        subtotal_mxn: calcSubtotal,
        delivery_fee: calcDeliveryFee,
        total_mxn: calcTotal,
        anticipo_mxn: calcAnticipo,
        anticipo_paid: anticipoPaid,
        full_paid: payMode === 'full_prepay' && anticipoPaid,
        delivery_mode: delivMode,
        delivery_zone: delivMode === 'pickup' ? 'pickup' : delivZone,
        is_night: isNight,
        payment_mode: payMode,
        delivery_address: delivAddress.trim(),
        customer_notes: delivNotes.trim(),
        delivery_notes: delivNotes.trim(),
        admin_notes: adminNotes.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      mockOrders.unshift(fakeOrder)
      localStorage.setItem('dp_mock_orders', JSON.stringify(mockOrders))
      setOrders(prev => [fakeOrder, ...prev])
      setCreatedOrderSuccess(fakeOrder)
      toast.success(`¡Pedido #${fakeOrder.order_number} creado con éxito!`)
      setCreateSubmitting(false)
      return
    }

    try {
      const payload = {
        customer_name: custName.trim(),
        customer_phone: custPhone.trim(),
        customer_email: custEmail.trim() || undefined,
        delivery_mode: delivMode,
        delivery_zone: delivMode === 'pickup' ? 'pickup' : delivZone,
        is_night: isNight,
        delivery_address: delivAddress.trim(),
        delivery_notes: delivNotes.trim(),
        admin_notes: adminNotes.trim(),
        payment_mode: payMode,
        anticipo_paid: anticipoPaid,
        subtotal_mxn: calcSubtotal,
        delivery_fee: calcDeliveryFee,
        total_mxn: calcTotal,
        anticipo_mxn: calcAnticipo,
        status: initialStatus,
        send_email: sendEmailNotify && !!custEmail.trim(),
        items: orderItems,
      }

      const res = await adminFetch('/api/admin/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al registrar pedido')
      }

      toast.success(`¡Pedido #${data.order.order_number} creado con éxito!`)
      setOrders(prev => [data.order, ...prev])
      setCreatedOrderSuccess(data.order)
    } catch (err: any) {
      toast.error(err.message || 'Error al crear pedido')
    } finally {
      setCreateSubmitting(false)
    }
  }

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

  // Polling fallback every 10s
  useEffect(() => {
    const timer = setInterval(() => { load() }, 10000)
    return () => clearInterval(timer)
  }, [load])

  // 1-Click copy helper
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
      toast.error('No se pudo copiar')
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
          body: JSON.stringify({ id, updates }),
        })
        return res.ok
      } catch (e) {
        return false
      }
    }
  }

  async function advanceStatus(order: Order, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    const next = NEXT_STATUS[order.status]
    if (!next) return

    setUpdating(order.id)
    const success = await performUpdate(order.id, { status: next })

    if (!success) {
      toast.error('Error actualizando pedido')
    } else {
      setOrders(os => os.map(o => o.id === order.id ? { ...o, status: next } : o))
      toast.success(`${order.order_number} → ${STATUS_LABELS[next]?.label || next}`)

      // If confirming: automatically open WhatsApp
      if (order.status === 'pending') {
        const url = buildConfirmationUrl(toMessageOrder({ ...order, status: next }))
        window.open(url, '_blank')
      }
    }
    setUpdating(null)
  }

  function openCancelModal(order: Order, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    setCancelModalOrder(order)
    setCancelReason('Falta de anticipo (tiempo límite expirado)')
    setCancelNotifyEmail(Boolean(order.customer_email))
  }

  async function confirmCancellation() {
    if (!cancelModalOrder) return
    const order = cancelModalOrder
    setUpdating(order.id)
    await performUpdate(order.id, { status: 'cancelled' })
    setOrders(os => os.map(o => o.id === order.id ? { ...o, status: 'cancelled' } : o))
    toast.success(`Pedido ${order.order_number} cancelado`)

    if (cancelNotifyEmail && order.customer_email) {
      await sendEmailAction(order, 'cancel', cancelReason)
    }

    setUpdating(null)
    setCancelModalOrder(null)
  }

  async function toggleAnticipo(order: Order, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    const newVal = !order.anticipo_paid
    setUpdating(order.id)
    const success = await performUpdate(order.id, { anticipo_paid: newVal })
    if (success) {
      setOrders(os => os.map(o => o.id === order.id ? { ...o, anticipo_paid: newVal } : o))
      toast.success(newVal ? '💳 Anticipo marcado como recibido' : '💳 Anticipo desmarcado')
    } else {
      toast.error('Error al actualizar anticipo')
    }
    setUpdating(null)
  }

  async function saveNotes(order: Order, notes: string) {
    await performUpdate(order.id, { admin_notes: notes })
    setOrders(os => os.map(o => o.id === order.id ? { ...o, admin_notes: notes } : o))
    toast.success('Notas guardadas', { id: `notes-${order.id}` })
  }

  async function sendEmailAction(order: Order, type: 'pre_confirm' | 'reminder' | 'confirm' | 'location' | 'cancel', customReason?: string) {
    if (!order.customer_email) return
    setUpdating(order.id)
    toast.loading('Enviando correo...', { id: 'sending-email' })

    let subject = ''
    let html = ''

    if (type === 'pre_confirm') {
      const isFull = order.payment_mode === 'full_prepay' || (order.delivery_mode === 'pickup' && order.payment_mode !== 'pickup_cash')
      const amountToPay = (isFull ? order.total_mxn : (order.anticipo_mxn || 50)).toLocaleString('es-MX')
      subject = `Tu pedido está casi listo 🤝 - Pedido ${order.order_number}`
      const introCopy = isFull
        ? `<p>Para mandar tu pedido directo a preparación por la vía rápida, requerimos el pago total de <strong>$${amountToPay} MXN</strong>.</p>`
        : `<p>Para separar tus piezas y agendar la entrega, pedimos un anticipo de <strong>$${amountToPay} MXN</strong>. (Esto nos ayuda a asegurar que el trato es serio y apartar tu mercancía sin broncas).</p>
           <p>El resto lo liquidas al momento de la entrega.</p>`
      const content = `
        <p>¡Qué onda ${order.customer_name}! Gracias por armar tu pedido con Distrito Pipa.</p>
        ${introCopy}
        <p>Aquí te dejo los datos para la transferencia:</p>
        <ul>
          <li><strong>Banco:</strong> ${BANK_CONFIG.bankName}</li>
          <li><strong>CLABE:</strong> ${BANK_CONFIG.formattedClabe}</li>
          <li><strong>A nombre de:</strong> ${BANK_CONFIG.recipient}</li>
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
                      <p>Tu paquete ya te está esperando. En breve te pasaremos las coordenadas exactas de nuestro spot y nos pondremos de acuerdo para tu recolección.</p>`
        } else {
          copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${order.order_number}</strong> está confirmado gracias a tu anticipo. Cero sorpresas.</p>
                      <p>Tu paquete ya te está esperando; recuerda que <strong>el saldo pendiente se liquida en efectivo al momento de recolectarlo</strong>.</p>
                      <p>En breve te pasaremos las coordenadas exactas de nuestro spot y nos pondremos de acuerdo para tu recolección.</p>`
        }
      } else {
        if (order.payment_mode === 'full_prepay') {
          copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${order.order_number}</strong> está 100% confirmado y pagado. Cero sorpresas.</p>
                      <p>Seguimos moviéndonos por Cancún para entregarte rápido. En breve armamos la ruta y afinamos detalles.</p>`
        } else {
          copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${order.order_number}</strong> está confirmado gracias a tu anticipo. Cero sorpresas.</p>
                      <p>Seguimos moviéndonos por Cancún para entregarte rápido; recuerda que <strong>el saldo pendiente se liquida en efectivo al momento de recibir tus artículos</strong>.</p>
                      <p>En breve armamos la ruta y afinamos detalles.</p>`
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
          price: item.unit_price || item.price || 0,
          bundle_price: item.bundle_price,
          total_price: item.bundle_price ?? ((item.unit_price || item.price || 0) * (item.qty || item.quantity || 1)),
        })),
        subtotal: order.subtotal_mxn || 0,
        deliveryFee: order.delivery_fee || 0,
        total: order.total_mxn || 0,
        anticipoPaid,
      })

      const content = `
        <p>¡Listo ${order.customer_name.split(' ')[0]}! Ya nos cayó tu pago. Gracias por la confianza.</p>
        ${copyBody}
        ${orderSummaryHtml}
        <p>Mientras empaquetamos tus cosas en nuestra bolsa Kraft, siéntete libre de ver lo que andan armando tus vecinos en nuestro Instagram (<a href="https://instagram.com/distritopipa" target="_blank">@distritopipa</a>) o en nuestro <a href="https://www.facebook.com/distritopipacancun/" target="_blank">Facebook</a>.</p>
        <p>¡Aquí andamos para cualquier cosa!</p>
      `
      html = getBrandedEmailHtml('Pago Recibido', content)
    } else if (type === 'location') {
      subject = `Coordenadas para tu entrega 📍 - Pedido ${order.order_number}`
      const content = `
        <p>¡Qué onda ${order.customer_name}! Todo listo para entregarte tu paquete.</p>
        <p>Nos vemos en nuestro punto de encuentro en la Región 96:</p>
        <p>📍 <strong>Región 96 — Soriana Nichupté / Coppel Nichupté, Cancún</strong></p>
        <p>Recuerda tener a la mano el resto de tu pago en efectivo y estar puntual. Nos vemos pronto.</p>
        <p>Si tienes algún contratiempo, tíranos un mensaje por WhatsApp con anticipación para coordinarnos. ¡Ahí nos vemos!</p>
      `
      html = getBrandedEmailHtml('Ubicación de Pick Up', content)
    } else if (type === 'cancel') {
      subject = `Liberamos tus piezas 📦 - Pedido ${order.order_number}`
      let items = []
      try {
        items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || [])
      } catch (e) {
        items = []
      }

      html = renderCancellationEmailHtml({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        items: items.map((item: any) => ({
          name: item.name,
          title: item.title,
          quantity: item.qty || item.quantity || 1,
          price: item.unit_price || item.price || 0,
          bundle_price: item.bundle_price,
          total_price: item.bundle_price ?? ((item.unit_price || item.price || 0) * (item.qty || item.quantity || 1)),
        })),
        subtotal: order.subtotal_mxn || 0,
        deliveryFee: order.delivery_fee || 0,
        total: order.total_mxn || 0,
        reason: customReason,
      })
    }

    try {
      const res = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: order.customer_email, subject, html }),
      })
      if (res.ok) {
        toast.success('Correo enviado con éxito', { id: 'sending-email' })
      } else {
        toast.error('Error al enviar correo', { id: 'sending-email' })
      }
    } catch {
      toast.error('Error de conexión', { id: 'sending-email' })
    }
    setUpdating(null)
  }

  // ── VIP calculation per phone ──────────────────────────────
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

  // ── Metrics & Counts ───────────────────────────────────────
  const counts = useMemo(() => ({
    total: orders.length,
    active: orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length,
    pending: orders.filter(o => o.status === 'pending').length,
    noDeposit: orders.filter(o => o.payment_mode !== 'pickup_cash' && !o.anticipo_paid && !['delivered', 'cancelled'].includes(o.status)).length,
    preparing: orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status)).length,
    delivery: orders.filter(o => o.delivery_mode === 'delivery' && !['delivered', 'cancelled'].includes(o.status)).length,
    pickup: orders.filter(o => o.delivery_mode === 'pickup' && !['delivered', 'cancelled'].includes(o.status)).length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }), [orders])

  const today = new Date().toDateString()
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today)
  const todayRevenue = todayOrders
    .filter(o => o.status === 'delivered')
    .reduce((s, o) => s + (o.total_mxn || 0), 0)

  // ── Filter & Search Pipeline ───────────────────────────────
  const filteredAndSortedOrders = useMemo(() => {
    let list = [...orders]

    // Search query (number, client, phone, email, address, product names)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      list = list.filter(o => {
        const num = (o.order_number || '').toLowerCase()
        const name = (o.customer_name || '').toLowerCase()
        const phone = (o.customer_phone || '').replace(/\D/g, '')
        const email = (o.customer_email || '').toLowerCase()
        const addr = (o.delivery_address || '').toLowerCase()
        const notes = `${o.customer_notes || ''} ${o.delivery_notes || ''} ${o.admin_notes || ''}`.toLowerCase()
        const itemsText = (o.items || []).map(i => i.name.toLowerCase()).join(' ')
        return num.includes(q) || name.includes(q) || phone.includes(q) || email.includes(q) || addr.includes(q) || itemsText.includes(q) || notes.includes(q)
      })
    }

    // Filter key
    switch (filter) {
      case 'active':
        list = list.filter(o => !['delivered', 'cancelled'].includes(o.status))
        break
      case 'pending':
        list = list.filter(o => o.status === 'pending')
        break
      case 'no_deposit':
        list = list.filter(o => o.payment_mode !== 'pickup_cash' && !o.anticipo_paid && !['delivered', 'cancelled'].includes(o.status))
        break
      case 'preparing':
        list = list.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status))
        break
      case 'delivery':
        list = list.filter(o => o.delivery_mode === 'delivery' && !['delivered', 'cancelled'].includes(o.status))
        break
      case 'pickup':
        list = list.filter(o => o.delivery_mode === 'pickup' && !['delivered', 'cancelled'].includes(o.status))
        break
      case 'delivered':
        list = list.filter(o => o.status === 'delivered')
        break
      case 'cancelled':
        list = list.filter(o => o.status === 'cancelled')
        break
      case 'all':
      default:
        break
    }

    // Sorting
    list.sort((a, b) => {
      switch (sortField) {
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'total_desc':
          return (b.total_mxn || 0) - (a.total_mxn || 0)
        case 'deposit_pending': {
          const aNeed = (a.payment_mode !== 'pickup_cash' && !a.anticipo_paid && !['delivered', 'cancelled'].includes(a.status)) ? 1 : 0
          const bNeed = (b.payment_mode !== 'pickup_cash' && !b.anticipo_paid && !['delivered', 'cancelled'].includes(b.status)) ? 1 : 0
          if (bNeed !== aNeed) return bNeed - aNeed
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }
        case 'delivery_first': {
          const aDel = a.delivery_mode === 'delivery' ? 1 : 0
          const bDel = b.delivery_mode === 'delivery' ? 1 : 0
          if (bDel !== aDel) return bDel - aDel
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }
        case 'pickup_first': {
          const aPick = a.delivery_mode === 'pickup' ? 1 : 0
          const bPick = b.delivery_mode === 'pickup' ? 1 : 0
          if (bPick !== aPick) return bPick - aPick
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }
        default:
          return 0
      }
    })

    return list
  }, [orders, searchTerm, filter, sortField])

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="orders-page">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" />

      {/* ── WhatsApp preview modal ── */}
      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="preview-modal" onClick={e => e.stopPropagation()}>
            <div className="preview-header">
              <div>
                <div className="preview-title">Vista Previa de WhatsApp</div>
                <div className="preview-sub">
                  {PAYMENT_LABELS[preview.payment_mode]} · #{preview.order_number} · {preview.customer_name}
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
                onClick={() => copyToClipboard(buildConfirmationText(toMessageOrder(preview)), 'Mensaje de WhatsApp')}
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

      {/* ── Cancellation modal ── */}
      {cancelModalOrder && (
        <div className="modal-overlay" onClick={() => setCancelModalOrder(null)}>
          <div className="preview-modal cancel-modal" onClick={e => e.stopPropagation()}>
            <div className="preview-header cancel-header">
              <div>
                <div className="preview-title text-danger">🚫 Cancelar Pedido & Liberar Stock</div>
                <div className="preview-sub">
                  Pedido #{cancelModalOrder.order_number} · {cancelModalOrder.customer_name}
                </div>
              </div>
              <button className="close-btn" onClick={() => setCancelModalOrder(null)}>✕</button>
            </div>

            <div className="preview-body flex-col gap-4">
              <div>
                <label className="form-label">Motivo de cancelación:</label>
                <select
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="form-select"
                >
                  <option value="Falta de anticipo (tiempo límite expirado)">Falta de anticipo (tiempo límite expirado)</option>
                  <option value="Sin respuesta / Cliente no confirmó ubicación">Sin respuesta / Cliente no confirmó ubicación</option>
                  <option value="Sin existencias de inventario">Sin existencias de inventario</option>
                  <option value="A petición del cliente">A petición del cliente</option>
                  <option value="Pedido de prueba / duplicado">Pedido de prueba / duplicado</option>
                </select>
              </div>

              {cancelModalOrder.customer_email ? (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={cancelNotifyEmail}
                    onChange={e => setCancelNotifyEmail(e.target.checked)}
                    className="checkbox-input"
                  />
                  <span>Enviar correo oficial (<em>&ldquo;Liberamos tus piezas&rdquo;</em>) a <strong>{cancelModalOrder.customer_email}</strong></span>
                </label>
              ) : (
                <div className="hint-text">
                  ℹ️ Este cliente no tiene correo registrado; infórmale por WhatsApp.
                </div>
              )}

              <div className="cancel-preview-box">
                <div className="preview-box-label">Mensaje para WhatsApp:</div>
                <div className="preview-box-text">
                  {buildCancellationText(toMessageOrder(cancelModalOrder))}
                </div>
                <a
                  className="btn-whatsapp-sm mt-2"
                  href={buildCancellationUrl(toMessageOrder(cancelModalOrder))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 Abrir aviso en WhatsApp →
                </a>
              </div>
            </div>

            <div className="preview-footer justify-between">
              <button className="btn-ghost" onClick={() => setCancelModalOrder(null)}>Volver</button>
              <button
                className="btn-danger-confirm"
                disabled={Boolean(updating)}
                onClick={confirmCancellation}
              >
                {updating === cancelModalOrder.id ? 'Cancelando...' : 'Confirmar Cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE ORDER MODAL ── */}
      {isCreateOpen && (
        <div className="modal-overlay" onClick={() => !createSubmitting && setIsCreateOpen(false)}>
          <div className="preview-modal create-modal" onClick={e => e.stopPropagation()}>
            {createdOrderSuccess ? (
              /* Success View */
              <div className="preview-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
                <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '6px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1px' }}>
                  ¡Pedido #{createdOrderSuccess.order_number} Registrado!
                </h3>
                <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '20px' }}>
                  El pedido fue guardado exitosamente en la base de datos y sumado a tus métricas.
                </p>

                <div style={{ background: '#111', border: '1px solid #282828', borderRadius: '10px', padding: '16px', textAlign: 'left', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#888' }}>Cliente:</span>
                    <strong style={{ color: '#fff' }}>{createdOrderSuccess.customer_name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#888' }}>WhatsApp:</span>
                    <strong style={{ color: '#fff' }}>{createdOrderSuccess.customer_phone}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#888' }}>Modalidad:</span>
                    <strong style={{ color: '#fff' }}>{DELIVERY_LABELS[createdOrderSuccess.delivery_mode] || createdOrderSuccess.delivery_mode}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', paddingTop: '10px', borderTop: '1px solid #262626' }}>
                    <span style={{ color: '#aaa', fontWeight: 600 }}>Total Pedido:</span>
                    <strong style={{ color: '#DC143C', fontSize: '17px' }}>${(createdOrderSuccess.total_mxn || 0).toLocaleString('es-MX')} MXN</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <a
                    className="btn-whatsapp"
                    href={buildConfirmationUrl(toMessageOrder(createdOrderSuccess))}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: '12px', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}
                  >
                    💬 Enviar Confirmación por WhatsApp →
                  </a>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ flex: 1, padding: '10px', fontSize: '13px' }}
                      onClick={() => {
                        setIsCreateOpen(false)
                        setCreatedOrderSuccess(null)
                      }}
                    >
                      Ver en la cola
                    </button>
                    <button
                      type="button"
                      style={{ flex: 1, padding: '10px', fontSize: '13px', background: '#262626', color: '#fff', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                      onClick={resetCreateForm}
                    >
                      + Crear otro pedido
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Order Form */
              <>
                <div className="preview-header">
                  <div>
                    <div className="preview-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>+ Crear Pedido Manual</span>
                      <span style={{ fontSize: '10px', background: 'rgba(220, 20, 60, 0.15)', color: '#DC143C', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(220, 20, 60, 0.3)', fontWeight: 700 }}>ADMIN</span>
                    </div>
                    <div className="preview-sub">Registra pedidos de WhatsApp, llamadas o mostrador Región 96.</div>
                  </div>
                  <button className="close-btn" onClick={() => setIsCreateOpen(false)}>✕</button>
                </div>

                <form onSubmit={handleCreateOrderSubmit}>
                  <div className="create-modal-body">
                    {/* SECCIÓN 1: DATOS DEL CLIENTE */}
                    <div className="form-section">
                      <div className="form-section-title">👤 1. Datos del Cliente</div>
                      <div className="form-row-grid">
                        <div>
                          <label className="form-label">Nombre del Cliente *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej: Daniel Vargas"
                            className="form-input"
                            value={custName}
                            onChange={e => setCustName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="form-label">WhatsApp (10 dígitos) *</label>
                          <input
                            type="tel"
                            required
                            placeholder="Ej: 9981234567"
                            className="form-input"
                            value={custPhone}
                            onChange={e => setCustPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: '10px' }}>
                        <label className="form-label">Correo Electrónico (Opcional)</label>
                        <input
                          type="email"
                          placeholder="cliente@ejemplo.com"
                          className="form-input"
                          value={custEmail}
                          onChange={e => setCustEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* SECCIÓN 2: ARTÍCULOS */}
                    <div className="form-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div className="form-section-title" style={{ margin: 0 }}>🛍️ 2. Artículos ({orderItems.length})</div>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ fontSize: '11px', padding: '3px 8px', color: '#DC143C' }}
                          onClick={handleAddCustomItem}
                        >
                          + Personalizado
                        </button>
                      </div>

                      <div style={{ marginBottom: '12px' }}>
                        <select
                          className="form-select"
                          value=""
                          disabled={loadingProducts}
                          onChange={e => {
                            handleSelectProduct(e.target.value)
                            e.target.value = ""
                          }}
                        >
                          <option value="">{loadingProducts ? 'Cargando catálogo...' : '➕ Seleccionar producto del catálogo para agregar...'}</option>
                          {catalogProducts.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name_es} — ${(p.price_mxn || 0).toLocaleString('es-MX')} MXN
                            </option>
                          ))}
                        </select>
                      </div>

                      {orderItems.length === 0 ? (
                        <div style={{ padding: '16px', background: '#111', borderRadius: '8px', border: '1px dashed #333', textAlign: 'center', color: '#777', fontSize: '12px' }}>
                          Selecciona un producto arriba o haz clic en &quot;+ Personalizado&quot; para agregarlo.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {orderItems.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#111', border: '1px solid #262626', borderRadius: '8px', padding: '10px' }}>
                              <div style={{ flex: 3 }}>
                                <input
                                  type="text"
                                  required
                                  placeholder="Nombre del artículo"
                                  className="form-input"
                                  style={{ fontSize: '12px', padding: '6px 8px' }}
                                  value={item.name}
                                  onChange={e => handleUpdateItem(idx, 'name', e.target.value)}
                                />
                              </div>
                              <div style={{ flex: 1.5 }}>
                                <input
                                  type="text"
                                  placeholder="Color / Var"
                                  className="form-input"
                                  style={{ fontSize: '12px', padding: '6px 8px' }}
                                  value={item.color || ''}
                                  onChange={e => handleUpdateItem(idx, 'color', e.target.value)}
                                />
                              </div>
                              <div style={{ width: '60px' }}>
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  title="Cantidad"
                                  className="form-input"
                                  style={{ fontSize: '12px', padding: '6px 6px', textAlign: 'center' }}
                                  value={item.qty}
                                  onChange={e => handleUpdateItem(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                />
                              </div>
                              <div style={{ width: '80px' }}>
                                <input
                                  type="number"
                                  min="0"
                                  required
                                  title="Precio Unitario"
                                  className="form-input"
                                  style={{ fontSize: '12px', padding: '6px 6px', textAlign: 'right' }}
                                  value={item.unit_price}
                                  onChange={e => handleUpdateItem(idx, 'unit_price', Math.max(0, parseFloat(e.target.value) || 0))}
                                />
                              </div>
                              <div style={{ width: '65px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#fff' }}>
                                ${((item.bundle_price ?? item.unit_price * (item.qty || 1))).toLocaleString('es-MX')}
                              </div>
                              <button
                                type="button"
                                title="Eliminar artículo"
                                style={{ background: 'none', border: 'none', color: '#ff5555', cursor: 'pointer', padding: '4px', fontSize: '14px' }}
                                onClick={() => handleRemoveItem(idx)}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SECCIÓN 3: ENTREGA */}
                    <div className="form-section">
                      <div className="form-section-title">🛵 3. Entrega & Logística</div>
                      <div className="form-row-grid">
                        <div>
                          <label className="form-label">Modalidad de Entrega</label>
                          <select
                            className="form-select"
                            value={delivMode === 'pickup' ? 'pickup' : (delivMode === 'punto_medio' ? 'punto_medio' : delivZone)}
                            onChange={e => {
                              const val = e.target.value
                              if (val === 'pickup') {
                                setDelivMode('pickup')
                                if (payMode === 'deposit') setPayMode('pickup_cash')
                              } else if (val === 'punto_medio') {
                                setDelivMode('punto_medio')
                              } else if (val === 'zone1') {
                                setDelivMode('delivery')
                                setDelivZone('zone1')
                                if (payMode === 'pickup_cash') setPayMode('deposit')
                              } else if (val === 'zone2') {
                                setDelivMode('delivery')
                                setDelivZone('zone2')
                                if (payMode === 'pickup_cash') setPayMode('deposit')
                              }
                            }}
                          >
                            <option value="pickup">📍 Recolección Región 96 ($0 MXN)</option>
                            <option value="zone1">🚗 Domicilio Zona 1 (1–6 km: $50 / $80 noche)</option>
                            <option value="zone2">🚗 Domicilio Zona 2 (6–10 km: $80 / $100 noche)</option>
                            <option value="punto_medio">🏢 Punto Medio Cancún ($0 MXN)</option>
                          </select>
                        </div>

                        <div>
                          <label className="form-label">Costo de Envío ($ MXN)</label>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="number"
                              min="0"
                              className="form-input"
                              placeholder={calcDeliveryFee.toString()}
                              value={customDeliveryFee}
                              onChange={e => setCustomDeliveryFee(e.target.value)}
                            />
                            {customDeliveryFee !== '' && (
                              <button
                                type="button"
                                className="btn-ghost"
                                style={{ fontSize: '11px', whiteSpace: 'nowrap', padding: '6px 8px' }}
                                onClick={() => setCustomDeliveryFee('')}
                              >
                                Auto ({calcDeliveryFee})
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: '10px' }}>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={isNight}
                            onChange={e => setIsNight(e.target.checked)}
                            className="checkbox-input"
                          />
                          <span>🌙 <strong>Horario Nocturno (+8:00 PM)</strong> — Recargo noche (+${delivZone === 'zone2' ? '20' : '30'} MXN)</span>
                        </label>
                      </div>

                      {delivMode === 'delivery' && (
                        <div style={{ marginTop: '12px' }}>
                          <label className="form-label">Dirección de Entrega *</label>
                          <input
                            type="text"
                            required
                            placeholder="Calle, Número, Región / Supermanzana, Referencias..."
                            className="form-input"
                            value={delivAddress}
                            onChange={e => setDelivAddress(e.target.value)}
                          />
                        </div>
                      )}

                      <div style={{ marginTop: '12px' }}>
                        <label className="form-label">Notas / Instrucciones de Entrega (Cliente)</label>
                        <input
                          type="text"
                          placeholder="Ej: Portón café, timbrar dos veces, entregar a su hermano..."
                          className="form-input"
                          value={delivNotes}
                          onChange={e => setDelivNotes(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* SECCIÓN 4: PAGO & ESTADO */}
                    <div className="form-section">
                      <div className="form-section-title">💳 4. Forma de Pago & Estado Inicial</div>
                      <div className="form-row-grid">
                        <div>
                          <label className="form-label">Forma de Pago</label>
                          <select
                            className="form-select"
                            value={payMode}
                            onChange={e => {
                              const val = e.target.value as any
                              setPayMode(val)
                              if (val === 'full_prepay') setAnticipoPaid(true)
                            }}
                          >
                            <option value="deposit">📱 Anticipo $50 transferencia + Saldo contra-entrega</option>
                            <option value="pickup_cash">💵 Efectivo al recoger / entregar</option>
                            <option value="full_prepay">💳 Pago 100% anticipado (Transferencia / SPEI)</option>
                          </select>
                        </div>

                        <div>
                          <label className="form-label">Estado Inicial del Pedido</label>
                          <select
                            className="form-select"
                            value={initialStatus}
                            onChange={e => setInitialStatus(e.target.value)}
                          >
                            <option value="confirmed">✅ Confirmado / Apartado (Recomendado)</option>
                            <option value="pending">⏳ Pendiente (Por confirmar)</option>
                            <option value="preparing">📦 En preparación</option>
                            <option value="ready">🏁 Listo para entrega</option>
                            <option value="delivered">🎉 Entregado y liquidado</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-row-grid" style={{ marginTop: '10px' }}>
                        <div>
                          <label className="form-label">Monto de Anticipo ($ MXN)</label>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="number"
                              min="0"
                              className="form-input"
                              placeholder={calcAnticipo.toString()}
                              value={customAnticipo}
                              onChange={e => setCustomAnticipo(e.target.value)}
                            />
                            {customAnticipo !== '' && (
                              <button
                                type="button"
                                className="btn-ghost"
                                style={{ fontSize: '11px', whiteSpace: 'nowrap', padding: '6px 8px' }}
                                onClick={() => setCustomAnticipo('')}
                              >
                                Auto ({calcAnticipo})
                              </button>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={anticipoPaid}
                              onChange={e => setAnticipoPaid(e.target.checked)}
                              className="checkbox-input"
                            />
                            <span><strong>¿Anticipo ya pagado / recibido?</strong></span>
                          </label>
                        </div>
                      </div>

                      {custEmail.trim() && (
                        <div style={{ marginTop: '10px' }}>
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={sendEmailNotify}
                              onChange={e => setSendEmailNotify(e.target.checked)}
                              className="checkbox-input"
                            />
                            <span>Enviar confirmación por correo a <strong>{custEmail}</strong></span>
                          </label>
                        </div>
                      )}

                      <div style={{ marginTop: '12px' }}>
                        <label className="form-label">Notas Internas (Admin)</label>
                        <input
                          type="text"
                          placeholder="Ej: Cliente frecuente de WhatsApp, pedido express..."
                          className="form-input"
                          value={adminNotes}
                          onChange={e => setAdminNotes(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* RESUMEN FINANCIERO */}
                    <div className="create-summary-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                        <span style={{ color: '#888' }}>Subtotal ({orderItems.reduce((s, i) => s + (i.qty || 1), 0)} pzs):</span>
                        <span style={{ color: '#ccc' }}>${calcSubtotal.toLocaleString('es-MX')} MXN</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                        <span style={{ color: '#888' }}>Costo de Envío:</span>
                        <span style={{ color: '#ccc' }}>${calcDeliveryFee.toLocaleString('es-MX')} MXN</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, paddingTop: '8px', borderTop: '1px solid #262626', marginBottom: '6px' }}>
                        <span style={{ color: '#fff' }}>TOTAL DEL PEDIDO:</span>
                        <span style={{ color: '#DC143C' }}>${calcTotal.toLocaleString('es-MX')} MXN</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: '#aaa' }}>
                          {payMode === 'full_prepay'
                            ? '💳 100% Pagado'
                            : (anticipoPaid ? `✓ Anticipo $${calcAnticipo} pagado` : `⏳ Anticipo $${calcAnticipo} pendiente`)}:
                        </span>
                        <span style={{ color: payMode === 'full_prepay' ? '#4ade80' : '#f59e0b', fontWeight: 700 }}>
                          {calcSaldoEntrega === 0 ? 'Liquidado $0' : `Saldo a cobrar contra-entrega: $${calcSaldoEntrega.toLocaleString('es-MX')} MXN`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="preview-footer justify-between" style={{ padding: '16px 20px', borderTop: '1px solid #262626' }}>
                    <button type="button" className="btn-ghost" onClick={() => setIsCreateOpen(false)}>
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={createSubmitting}
                      style={{ background: '#DC143C', borderColor: '#DC143C', color: '#fff', fontWeight: 700, padding: '10px 20px', cursor: 'pointer', borderRadius: '8px' }}
                    >
                      {createSubmitting ? 'Registrando...' : '💾 Registrar Pedido en el Sistema'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="page-header">
        <div>
          <div className="page-eyebrow">DISTRITO PIPA CANCÚN · OPERACIONES & DESPACHO</div>
          <h1 className="page-title">Cola de Pedidos</h1>
          <p className="page-subtitle">
            Gestión de entregas locales, cobros contra-entrega y comunicación directa con clientes y mensajeros.
          </p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn-primary"
            onClick={openCreateModal}
            style={{
              background: '#DC143C',
              borderColor: '#DC143C',
              color: '#fff',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Crear Pedido
          </button>
          <button className="btn-outline" onClick={load}>
            <span className="btn-icon">↺</span> Actualizar
          </button>
        </div>
      </header>

      {/* ── STATS ROW (Brand Board Style) ── */}
      <div className="stats-container">
        <div
          className={`stat-card clickable ${filter === 'pending' ? 'active-card' : ''}`}
          onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')}
        >
          <span className="stat-label">⏳ Pendientes</span>
          <span className="stat-val text-yellow">{counts.pending}</span>
          <span className="stat-sub">Por confirmar y apartar</span>
        </div>

        <div
          className={`stat-card clickable ${filter === 'active' ? 'active-card' : ''}`}
          onClick={() => setFilter(filter === 'active' ? 'all' : 'active')}
        >
          <span className="stat-label">⚡ En Pipeline</span>
          <span className="stat-val text-blue">{counts.active}</span>
          <span className="stat-sub">Activos en proceso</span>
        </div>

        <div
          className={`stat-card clickable alert-card ${filter === 'no_deposit' ? 'active-card' : ''}`}
          onClick={() => setFilter(filter === 'no_deposit' ? 'all' : 'no_deposit')}
        >
          <span className="stat-label">⚠️ Sin Anticipo ($50)</span>
          <span className="stat-val text-orange">{counts.noDeposit}</span>
          <span className="stat-sub">Requieren seguimiento</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">💰 Ventas Entregadas Hoy</span>
          <span className="stat-val text-brand">${todayRevenue.toLocaleString('es-MX')}</span>
          <span className="stat-sub">{todayOrders.filter(o => o.status === 'delivered').length} pedidos completados</span>
        </div>

        <div
          className={`stat-card clickable ${filter === 'delivered' ? 'active-card' : ''}`}
          onClick={() => setFilter(filter === 'delivered' ? 'all' : 'delivered')}
        >
          <span className="stat-label">✅ Total Entregados</span>
          <span className="stat-val text-green">{counts.delivered}</span>
          <span className="stat-sub">Histórico completado</span>
        </div>
      </div>

      {/* ── CONTROLS: SEARCH & SORT ── */}
      <div className="controls-bar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar por #DP, cliente, teléfono, dirección o producto..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>✕</button>
          )}
        </div>

        <div className="sort-wrap">
          <label className="sort-label">Ordenar:</label>
          <select
            value={sortField}
            onChange={e => setSortField(e.target.value as SortKey)}
            className="select-sort"
          >
            <option value="recent">🕒 Más reciente (Fecha)</option>
            <option value="total_desc">💰 Mayor valor ($ Total)</option>
            <option value="deposit_pending">⚠️ Sin anticipo primero</option>
            <option value="delivery_first">🛵 Envíos a domicilio primero</option>
            <option value="pickup_first">📍 Pickups (Reg. 96) primero</option>
          </select>
        </div>
      </div>

      {/* ── FILTER PILLS ── */}
      <div className="pills-container">
        {[
          { key: 'active',     label: `⚡ Activos (${counts.active})` },
          { key: 'pending',    label: `⏳ Pendientes (${counts.pending})` },
          { key: 'no_deposit', label: `⚠️ Sin Anticipo (${counts.noDeposit})` },
          { key: 'preparing',  label: `📦 En Preparación (${counts.preparing})` },
          { key: 'delivery',   label: `🛵 Envíos (${counts.delivery})` },
          { key: 'pickup',     label: `📍 Pickups (${counts.pickup})` },
          { key: 'delivered',  label: `✅ Entregados (${counts.delivered})` },
          { key: 'cancelled',  label: `🚫 Cancelados (${counts.cancelled})` },
          { key: 'all',        label: `Todos (${counts.total})` },
        ].map(f => (
          <button
            key={f.key}
            className={`pill ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key as FilterKey)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── ORDER LIST ── */}
      <div className="order-list">
        {loading && <div className="loading-state">Cargando pedidos de Distrito Pipa...</div>}
        {!loading && filteredAndSortedOrders.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">📦</span>
            <p className="empty-title">No se encontraron pedidos en esta vista.</p>
            <p className="empty-sub">Prueba cambiando los filtros o el término de búsqueda.</p>
          </div>
        )}

        {filteredAndSortedOrders.map(order => {
          const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: '#888' }
          const isExpanded = expanded === order.id
          const isUpdating = updating === order.id
          const nextStatus = NEXT_STATUS[order.status]
          const needsDeposit = order.payment_mode !== 'pickup_cash' && !order.anticipo_paid && !['delivered', 'cancelled'].includes(order.status)
          const cod = getCashOnDelivery(order)

          const cp = order.customer_phone || ''
          const phone = cp.replace(/\D/g, '') || cp
          const vip = vipByPhone[phone]

          return (
            <div
              key={order.id}
              className={`order-card ${order.status === 'cancelled' ? 'cancelled' : ''} ${isExpanded ? 'is-open' : ''}`}
            >
              {/* ── Card Top Header (Click to expand) ── */}
              <div className="card-top" onClick={() => setExpanded(isExpanded ? null : order.id)}>
                <div className="top-left">
                  {/* Status badge */}
                  <span
                    className="status-badge"
                    style={{ background: `${statusInfo.color}18`, color: statusInfo.color, borderColor: `${statusInfo.color}40` }}
                  >
                    {statusInfo.label}
                  </span>

                  {/* Order number in Bebas Neue */}
                  <span className="order-folio">#{order.order_number}</span>

                  {/* VIP Badge */}
                  {vip && vip.tier !== 'Ninguno' && (
                    <span
                      className="vip-tag"
                      style={{ color: getTierColor(vip.tier), borderColor: `${getTierColor(vip.tier)}40`, background: `${getTierColor(vip.tier)}12` }}
                    >
                      {getTierIcon(vip.tier)} {vip.tier}
                    </span>
                  )}

                  {/* Delivery Mode Badge */}
                  <span className={`mode-tag ${order.delivery_mode === 'pickup' ? 'mode-pickup' : 'mode-delivery'}`}>
                    {order.delivery_mode === 'pickup' ? '📍 Pickup Local' : '🛵 A Domicilio'}
                  </span>

                  {/* Night delivery alert */}
                  {order.is_night && (
                    <span className="night-tag">🌙 Nocturno (+8 PM)</span>
                  )}

                  {/* Missing deposit alert */}
                  {needsDeposit && (
                    <span className="deposit-tag">⚠️ Falta Anticipo $50</span>
                  )}
                </div>

                <div className="top-right">
                  <span className="order-amount">${(order.total_mxn || 0).toLocaleString('es-MX')} MXN</span>
                  <span className="chevron-indicator">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* ── Card Summary Bar & Quick Dispatch Actions ── */}
              <div className="card-summary-bar">
                <div className="summary-info">
                  <span className="client-name">{order.customer_name}</span>

                  {/* Phone with 1-click copy */}
                  <button
                    className="chip-copy"
                    title="Copiar número"
                    onClick={e => copyToClipboard(phone, 'Teléfono', e)}
                  >
                    📱 {phone || 'Sin número'}
                    <span className="copy-icon">📋</span>
                  </button>

                  {/* Address with 1-click copy */}
                  {order.delivery_address && order.delivery_mode === 'delivery' && (
                    <button
                      className="chip-copy chip-address"
                      title="Copiar dirección"
                      onClick={e => copyToClipboard(order.delivery_address || '', 'Dirección', e)}
                    >
                      📍 {order.delivery_address}
                      <span className="copy-icon">📋</span>
                    </button>
                  )}

                  {/* Cash on delivery balance callout */}
                  <span className={`cod-callout ${cod.isPaid ? 'cod-paid' : 'cod-pending'}`}>
                    {cod.label}
                  </span>

                  {/* Customer order notes badge */}
                  {(order.customer_notes || order.delivery_notes) && (
                    <button
                      className="chip-copy chip-customer-note"
                      title="Instrucciones del cliente. Clic para copiar"
                      onClick={e => copyToClipboard(order.customer_notes || order.delivery_notes || '', 'Notas del Cliente', e)}
                    >
                      💬 &ldquo;{(order.customer_notes || order.delivery_notes)?.slice(0, 32)}...&rdquo;
                      <span className="copy-icon">📋</span>
                    </button>
                  )}

                  <span className="date-stamp">
                    {new Date(order.created_at).toLocaleString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Quick Action Buttons */}
                <div className="summary-actions" onClick={e => e.stopPropagation()}>
                  {/* Master Dispatch Button */}
                  <button
                    className="btn-dispatch-quick"
                    title="Copiar dossier completo para repartidor o DiDi"
                    onClick={e => copyToClipboard(buildDispatchDossier(order), 'Ficha de Despacho', e)}
                  >
                    📋 Ficha Despacho
                  </button>

                  {/* WhatsApp Direct */}
                  <a
                    className="btn-wa-quick"
                    href={buildConfirmationUrl(toMessageOrder(order))}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir chat en WhatsApp"
                  >
                    💬 WhatsApp
                  </a>

                  {/* Advance pipeline */}
                  {nextStatus && (
                    <button
                      className="btn-advance-quick"
                      disabled={isUpdating}
                      onClick={e => advanceStatus(order, e)}
                    >
                      {isUpdating ? '...' : NEXT_LABEL[order.status]}
                    </button>
                  )}
                </div>
              </div>

              {/* ── Expanded Detail Drawer ── */}
              {isExpanded && (
                <div className="card-detail">
                  <div className="detail-grid">

                    {/* Column 1: Items & Financial Breakdown */}
                    <div className="detail-box">
                      <div className="box-title">
                        {order.status === 'wholesale_inquiry' ? 'Detalles de Cotización' : 'Productos & Artículos'}
                      </div>

                      {order.status === 'wholesale_inquiry' ? (
                        <div className="admin-notes-view">
                          {(order.admin_notes || '').split('\n').map((line, idx) => (
                            <p key={idx}>{line}</p>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="items-table">
                            {(order.items || []).map((item, i) => (
                              <div key={i} className="item-line">
                                <span className="item-qty-badge">{item.qty}x</span>
                                <span className="item-desc">
                                  {item.name}
                                  {item.color ? <span className="item-color"> · {item.color}</span> : ''}
                                  {item.bundle_qty ? <span className="item-bundle"> [Pack {item.bundle_qty}x]</span> : ''}
                                </span>
                                <span className="item-sum">
                                  ${(item.bundle_price ?? item.unit_price * item.qty).toLocaleString('es-MX')} MXN
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="finances-breakdown">
                            <div className="fin-row">
                              <span>Subtotal</span>
                              <span>${(order.subtotal_mxn || 0).toLocaleString('es-MX')} MXN</span>
                            </div>
                            {(order.delivery_fee || 0) > 0 && (
                              <div className="fin-row">
                                <span>Costo de Envío {order.is_night ? '(Nocturno)' : ''}</span>
                                <span>${(order.delivery_fee || 0).toLocaleString('es-MX')} MXN</span>
                              </div>
                            )}
                            <div className="fin-row fin-total">
                              <span>TOTAL DEL PEDIDO</span>
                              <span className="total-amount">${(order.total_mxn || 0).toLocaleString('es-MX')} MXN</span>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Cash on Delivery Box */}
                      <div className="cod-highlight-box">
                        <div className="cod-head">
                          <div className="cod-title-wrap">
                            <span className="cod-icon">💵</span>
                            <div>
                              <div className="cod-title">Cobro Contra-Entrega (Cancún)</div>
                              <div className="cod-sub">Monto exacto a liquidar en efectivo al recibir</div>
                            </div>
                          </div>
                          <div className="cod-balance-val">
                            ${cod.amount.toLocaleString('es-MX')} <span className="currency">MXN</span>
                          </div>
                        </div>

                        {/* Anticipo switch bar */}
                        {order.payment_mode !== 'pickup_cash' && (
                          <div className="anticipo-controls">
                            <div className="anticipo-label-group">
                              <span className="anticipo-name">Anticipo requerido: ${(order.anticipo_mxn || 50).toLocaleString('es-MX')} MXN</span>
                              <span className={`anticipo-pill ${order.anticipo_paid ? 'paid' : 'unpaid'}`}>
                                {order.anticipo_paid ? '✓ Anticipo Recibido' : '⏳ Anticipo Pendiente'}
                              </span>
                            </div>
                            <button
                              className={`btn-anticipo-toggle ${order.anticipo_paid ? 'btn-unmark' : 'btn-mark'}`}
                              disabled={isUpdating}
                              onClick={e => toggleAnticipo(order, e)}
                            >
                              {order.anticipo_paid ? 'Desmarcar recibido' : '✓ Marcar anticipo pagado'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Column 2: Delivery & Customer Dossier */}
                    <div className="detail-box">
                      <div className="box-title">Logística & Datos del Cliente</div>
                      <div className="dossier-list">
                        <div className="dossier-row">
                          <span className="dossier-label">Cliente</span>
                          <span className="dossier-val bold">{order.customer_name}</span>
                        </div>

                        <div className="dossier-row">
                          <span className="dossier-label">WhatsApp / Tel</span>
                          <div className="dossier-actions-row">
                            <a
                              href={`https://wa.me/${phone.startsWith('52') ? phone : `52${phone}`}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="dossier-link"
                            >
                              {order.customer_phone || 'Sin teléfono'}
                            </a>
                            <button
                              className="btn-tiny-copy"
                              onClick={e => copyToClipboard(phone, 'Teléfono', e)}
                            >
                              📋 Copiar
                            </button>
                          </div>
                        </div>

                        {order.customer_email && (
                          <div className="dossier-row">
                            <span className="dossier-label">Correo</span>
                            <div className="dossier-actions-row">
                              <a href={`mailto:${order.customer_email}`} className="dossier-link">
                                {order.customer_email}
                              </a>
                              <button
                                className="btn-tiny-copy"
                                onClick={e => copyToClipboard(order.customer_email || '', 'Correo', e)}
                              >
                                📋 Copiar
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="dossier-row">
                          <span className="dossier-label">Modalidad</span>
                          <span className="dossier-val">{DELIVERY_LABELS[order.delivery_mode] || 'Entrega'}</span>
                        </div>

                        {/* Pickup vs Delivery Details */}
                        {order.delivery_mode === 'pickup' ? (
                          <div className="dossier-row flex-col">
                            <span className="dossier-label mb-1">Punto de Entrega Acordado</span>
                            <div className="address-banner">
                              📍 <strong>Región 96, Cancún</strong> — Soriana Nichupté / Coppel Nichupté.
                            </div>
                          </div>
                        ) : order.delivery_address && (
                          <div className="dossier-row flex-col">
                            <span className="dossier-label mb-1">Dirección de Entrega</span>
                            <div className="address-banner">
                              {order.delivery_address}
                            </div>
                            <div className="address-links-row">
                              <button
                                className="btn-tiny-copy"
                                onClick={e => copyToClipboard(order.delivery_address || '', 'Dirección', e)}
                              >
                                📋 Copiar Dirección
                              </button>
                              <a
                                href={getGoogleMapsUrl(order.delivery_address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-tiny-maps"
                              >
                                🗺️ Ver en Google Maps ↗
                              </a>
                            </div>
                          </div>
                        )}

                        {order.scheduled_at && (
                          <div className="dossier-row">
                            <span className="dossier-label">Horario Solicitado</span>
                            <span className="dossier-val">
                              {new Date(order.scheduled_at).toLocaleString('es-MX', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        )}

                        <div className="dossier-row">
                          <span className="dossier-label">Método de Pago</span>
                          <span className="dossier-val">{PAYMENT_LABELS[order.payment_mode] || '—'}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Customer Instructions from Checkout */}
                  {(order.customer_notes || order.delivery_notes) && (
                    <div className="customer-instructions-card">
                      <div className="cic-header">
                        <span className="cic-icon">💬</span>
                        <span className="cic-title">Instrucciones del Cliente (Checkout Online)</span>
                        <button
                          className="btn-tiny-copy ml-auto"
                          onClick={e => copyToClipboard(order.customer_notes || order.delivery_notes || '', 'Instrucciones del Cliente', e)}
                        >
                          📋 Copiar
                        </button>
                      </div>
                      <div className="cic-body">
                        &ldquo;{order.customer_notes || order.delivery_notes}&rdquo;
                      </div>
                    </div>
                  )}

                  {/* Internal Admin Notes */}
                  <div className="admin-notes-card">
                    <label className="notes-heading">📝 Notas Internas de Despacho (Solo visibles para ti)</label>
                    <textarea
                      className="notes-textarea"
                      defaultValue={order.admin_notes || ''}
                      placeholder="Ej: Mensajero DiDi asignado, llamar antes de salir, cliente paga con billete de $500..."
                      rows={2}
                      onBlur={e => saveNotes(order, e.target.value)}
                    />
                  </div>

                  {/* Bottom Action Strip */}
                  <div className="card-action-bar">
                    <button
                      className="btn-footer-dispatch"
                      onClick={e => copyToClipboard(buildDispatchDossier(order), 'Ficha de Despacho', e)}
                    >
                      📋 Copiar Ficha para Repartidor
                    </button>

                    <button
                      className="btn-footer-preview"
                      onClick={() => setPreview(order)}
                    >
                      👁 Ver Mensaje WhatsApp
                    </button>

                    <a
                      className="btn-footer-wa"
                      href={buildConfirmationUrl(toMessageOrder(order))}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      💬 Abrir Chat en WhatsApp
                    </a>

                    {nextStatus && (
                      <button
                        className="btn-footer-advance"
                        disabled={isUpdating}
                        onClick={e => advanceStatus(order, e)}
                      >
                        {isUpdating ? '...' : NEXT_LABEL[order.status]}
                      </button>
                    )}

                    {!['delivered', 'cancelled'].includes(order.status) && (
                      <button
                        className="btn-footer-cancel"
                        onClick={e => openCancelModal(order, e)}
                      >
                        🚫 Cancelar Pedido
                      </button>
                    )}
                  </div>

                  {/* Operational Emails Box */}
                  {order.customer_email && (
                    <div className="operational-emails-panel">
                      <div className="emails-title">
                        📧 Correos de Servicio al Cliente: <span className="email-target">{order.customer_email}</span>
                      </div>
                      <div className="emails-grid">
                        {order.status === 'pending' && (
                          <button className="btn-service-email" onClick={() => sendEmailAction(order, 'pre_confirm')}>
                            Enviar Pre-confirmación & Datos CLABE
                          </button>
                        )}
                        {(!order.anticipo_paid && order.payment_mode !== 'pickup_cash') && (
                          <button className="btn-service-email" onClick={() => sendEmailAction(order, 'reminder')}>
                            Enviar Recordatorio de Pago
                          </button>
                        )}
                        {order.status === 'confirmed' && (
                          <button className="btn-service-email" onClick={() => sendEmailAction(order, 'confirm')}>
                            Enviar Confirmación de Pago
                          </button>
                        )}
                        {(order.status === 'ready' && order.delivery_mode === 'pickup') && (
                          <button className="btn-service-email" onClick={() => sendEmailAction(order, 'location')}>
                            Enviar Coordenadas de Pick Up (Reg. 96)
                          </button>
                        )}
                        {order.status === 'cancelled' && (
                          <button className="btn-service-email email-cancel" onClick={() => sendEmailAction(order, 'cancel')}>
                            Enviar Notificación de Liberación de Piezas
                          </button>
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

      {/* ── STYLES ── */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .orders-page {
          min-height: 100vh;
          background: #111;
          color: #fff;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          padding: 32px 28px 80px;
        }

        /* ── HEADER ── */
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          gap: 16px;
        }

        .page-eyebrow {
          font-size: 11px;
          letter-spacing: 0.18em;
          color: #DC143C;
          text-transform: uppercase;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .page-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 40px;
          letter-spacing: 0.05em;
          color: #fff;
          line-height: 1;
          margin-bottom: 8px;
        }

        .page-subtitle {
          font-size: 13px;
          color: #888;
          max-width: 600px;
          line-height: 1.4;
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        .btn-outline {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          color: #fff;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-outline:hover {
          background: #222;
          border-color: #444;
        }

        /* ── STATS CONTAINER (Brand Board Cards) ── */
        .stats-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: all 0.2s;
        }

        .stat-card.clickable {
          cursor: pointer;
        }

        .stat-card.clickable:hover {
          background: #202020;
          border-color: #444;
          transform: translateY(-2px);
        }

        .stat-card.active-card {
          border-color: #DC143C;
          background: rgba(220, 20, 60, 0.08);
        }

        .stat-card.alert-card {
          border-color: rgba(251, 146, 60, 0.4);
          background: rgba(251, 146, 60, 0.05);
        }

        .stat-label {
          font-size: 11px;
          font-weight: 600;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-val {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 36px;
          line-height: 1;
          color: #fff;
        }

        .stat-sub {
          font-size: 11px;
          color: #666;
        }

        .text-yellow { color: #fbbf24; }
        .text-blue   { color: #60a5fa; }
        .text-orange { color: #fb923c; }
        .text-brand  { color: #DC143C; }
        .text-green  { color: #4ade80; }

        /* ── CONTROLS BAR ── */
        .controls-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .search-wrap {
          flex: 1;
          min-width: 280px;
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          font-size: 14px;
          color: #666;
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 10px 36px 10px 38px;
          color: #fff;
          font-size: 13px;
          transition: border-color 0.15s;
        }

        .search-input:focus {
          outline: none;
          border-color: #DC143C;
        }

        .clear-search {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: #888;
          font-size: 14px;
          cursor: pointer;
        }

        .sort-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sort-label {
          font-size: 12px;
          color: #888;
          white-space: nowrap;
        }

        .select-sort {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 10px 14px;
          color: #fff;
          font-size: 13px;
          cursor: pointer;
        }

        .select-sort:focus {
          outline: none;
          border-color: #DC143C;
        }

        /* ── FILTER PILLS ── */
        .pills-container {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: thin;
        }

        .pill {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          color: #888;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }

        .pill:hover {
          color: #fff;
          border-color: #444;
        }

        .pill.active {
          background: #DC143C;
          border-color: #DC143C;
          color: #fff;
          font-weight: 600;
        }

        /* ── ORDER LIST ── */
        .order-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .loading-state, .empty-state {
          background: #1a1a1a;
          border: 1px dashed #2a2a2a;
          border-radius: 12px;
          padding: 48px;
          text-align: center;
          color: #888;
        }

        .empty-icon { font-size: 32px; display: block; margin-bottom: 8px; }
        .empty-title { font-size: 15px; font-weight: 600; color: #fff; margin-bottom: 4px; }
        .empty-sub { font-size: 13px; color: #666; }

        /* ── ORDER CARD ── */
        .order-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .order-card:hover {
          border-color: #3a3a3a;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .order-card.is-open {
          border-color: #444;
        }

        .order-card.cancelled {
          opacity: 0.6;
        }

        /* Card Top */
        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 18px;
          cursor: pointer;
          user-select: none;
          background: #181818;
          border-bottom: 1px solid #222;
        }

        .top-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .status-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 14px;
          border: 1px solid;
          letter-spacing: 0.03em;
        }

        .order-folio {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 20px;
          letter-spacing: 0.05em;
          color: #fff;
        }

        .vip-tag {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;
          border: 1px solid;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }

        .mode-tag {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .mode-pickup {
          background: rgba(147, 51, 234, 0.15);
          color: #c084fc;
          border: 1px solid rgba(147, 51, 234, 0.3);
        }

        .mode-delivery {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .night-tag {
          font-size: 10px;
          font-weight: 600;
          background: rgba(234, 179, 8, 0.15);
          color: #facc15;
          border: 1px solid rgba(234, 179, 8, 0.3);
          padding: 2px 8px;
          border-radius: 10px;
        }

        .deposit-tag {
          font-size: 10px;
          font-weight: 600;
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
          padding: 2px 8px;
          border-radius: 10px;
        }

        .top-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .order-amount {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px;
          letter-spacing: 0.05em;
          color: #DC143C;
        }

        .chevron-indicator {
          font-size: 10px;
          color: #666;
        }

        /* Card Summary Bar */
        .card-summary-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 18px;
          gap: 12px;
          flex-wrap: wrap;
        }

        .summary-info {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .client-name {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .chip-copy {
          background: #111;
          border: 1px solid #2a2a2a;
          color: #bbb;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .chip-copy:hover {
          background: #222;
          color: #fff;
          border-color: #444;
        }

        .chip-address {
          max-width: 280px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .chip-customer-note {
          background: rgba(245, 158, 11, 0.12);
          border-color: rgba(245, 158, 11, 0.35);
          color: #fbbf24;
          max-width: 260px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .chip-customer-note:hover {
          background: rgba(245, 158, 11, 0.22);
          border-color: #f59e0b;
          color: #fef3c7;
        }

        .copy-icon {
          font-size: 10px;
          opacity: 0.6;
        }

        .cod-callout {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .cod-paid {
          background: rgba(74, 222, 128, 0.12);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.3);
        }

        .cod-pending {
          background: rgba(251, 146, 60, 0.12);
          color: #fb923c;
          border: 1px solid rgba(251, 146, 60, 0.3);
        }

        .date-stamp {
          font-size: 11px;
          color: #666;
        }

        /* Summary Quick Actions */
        .summary-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn-dispatch-quick {
          background: #DC143C;
          color: #fff;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }

        .btn-dispatch-quick:hover {
          background: #b90f32;
        }

        .btn-wa-quick {
          background: #25D366;
          color: #fff;
          text-decoration: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: background 0.15s;
        }

        .btn-wa-quick:hover {
          background: #20ba59;
        }

        .btn-advance-quick {
          background: #222;
          color: #fff;
          border: 1px solid #333;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-advance-quick:hover:not(:disabled) {
          background: #333;
          border-color: #555;
        }

        .btn-advance-quick:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ── EXPANDED CARD DETAIL ── */
        .card-detail {
          padding: 20px 18px;
          border-top: 1px solid #242424;
          background: #141414;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        @media (min-width: 860px) {
          .detail-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        .detail-box {
          background: #1a1a1a;
          border: 1px solid #262626;
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .box-title {
          font-size: 11px;
          font-weight: 700;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          border-bottom: 1px solid #262626;
          padding-bottom: 8px;
        }

        /* Items list */
        .items-table {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .item-line {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-size: 13px;
        }

        .item-qty-badge {
          background: #111;
          color: #888;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .item-desc {
          flex: 1;
          color: #eee;
        }

        .item-color {
          color: #888;
          font-size: 12px;
        }

        .item-bundle {
          color: #DC143C;
          font-size: 11px;
          font-weight: 600;
        }

        .item-sum {
          color: #fff;
          font-weight: 500;
        }

        .finances-breakdown {
          border-top: 1px solid #262626;
          padding-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .fin-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #888;
        }

        .fin-total {
          border-top: 1px dashed #333;
          padding-top: 8px;
          margin-top: 2px;
          color: #fff;
          font-weight: 600;
          font-size: 13px;
        }

        .total-amount {
          color: #DC143C;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 20px;
          letter-spacing: 0.05em;
        }

        /* Cash on delivery highlight box */
        .cod-highlight-box {
          background: #111;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .cod-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .cod-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cod-icon {
          font-size: 22px;
        }

        .cod-title {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
        }

        .cod-sub {
          font-size: 11px;
          color: #777;
        }

        .cod-balance-val {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 30px;
          line-height: 1;
          color: #4ade80;
        }

        .cod-balance-val .currency {
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          color: #888;
        }

        /* Anticipo controls */
        .anticipo-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 10px;
          border-top: 1px solid #222;
          gap: 10px;
          flex-wrap: wrap;
        }

        .anticipo-label-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .anticipo-name {
          font-size: 12px;
          color: #aaa;
        }

        .anticipo-pill {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .anticipo-pill.paid {
          background: rgba(74, 222, 128, 0.15);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.3);
        }

        .anticipo-pill.unpaid {
          background: rgba(251, 146, 60, 0.15);
          color: #fb923c;
          border: 1px solid rgba(251, 146, 60, 0.3);
        }

        .btn-anticipo-toggle {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid;
          transition: all 0.15s;
        }

        .btn-mark {
          background: rgba(74, 222, 128, 0.1);
          color: #4ade80;
          border-color: rgba(74, 222, 128, 0.3);
        }

        .btn-mark:hover {
          background: rgba(74, 222, 128, 0.2);
        }

        .btn-unmark {
          background: rgba(248, 113, 113, 0.1);
          color: #f87171;
          border-color: rgba(248, 113, 113, 0.3);
        }

        .btn-unmark:hover {
          background: rgba(248, 113, 113, 0.2);
        }

        /* Dossier list */
        .dossier-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .dossier-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          gap: 8px;
        }

        .dossier-row.flex-col {
          flex-direction: column;
          align-items: flex-start;
        }

        .dossier-label {
          font-size: 11px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .dossier-val {
          color: #ccc;
        }

        .dossier-val.bold {
          font-weight: 600;
          color: #fff;
        }

        .dossier-actions-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dossier-link {
          color: #4ade80;
          text-decoration: none;
        }

        .dossier-link:hover {
          text-decoration: underline;
        }

        .btn-tiny-copy {
          background: #111;
          border: 1px solid #333;
          color: #aaa;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-tiny-copy:hover {
          background: #222;
          color: #fff;
          border-color: #555;
        }

        .address-banner {
          background: #111;
          border: 1px solid #2a2a2a;
          padding: 10px 12px;
          border-radius: 6px;
          font-size: 13px;
          color: #eee;
          width: 100%;
          line-height: 1.4;
        }

        .address-links-row {
          display: flex;
          gap: 8px;
          margin-top: 6px;
        }

        .btn-tiny-maps {
          background: #111;
          border: 1px solid #333;
          color: #60a5fa;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 4px;
          text-decoration: none;
          transition: all 0.15s;
        }

        .btn-tiny-maps:hover {
          background: #1e3a8a;
          color: #fff;
        }

        /* Customer instructions card */
        .customer-instructions-card {
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .cic-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cic-header .ml-auto {
          margin-left: auto;
        }

        .cic-icon {
          font-size: 15px;
        }

        .cic-title {
          font-size: 12px;
          font-weight: 700;
          color: #fbbf24;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .cic-body {
          font-size: 13.5px;
          color: #f3f4f6;
          font-style: italic;
          line-height: 1.5;
          background: rgba(0, 0, 0, 0.25);
          padding: 8px 12px;
          border-radius: 6px;
          border-left: 3px solid #f59e0b;
        }

        /* Admin notes card */
        .admin-notes-card {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .notes-heading {
          font-size: 11px;
          font-weight: 600;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .notes-textarea {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          color: #eee;
          padding: 10px 12px;
          font-size: 13px;
          font-family: inherit;
          resize: vertical;
          transition: border-color 0.15s;
        }

        .notes-textarea:focus {
          outline: none;
          border-color: #DC143C;
        }

        /* Bottom Action Strip */
        .card-action-bar {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          padding-top: 10px;
          border-top: 1px solid #222;
        }

        .btn-footer-dispatch {
          background: #DC143C;
          color: #fff;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }

        .btn-footer-dispatch:hover {
          background: #b90f32;
        }

        .btn-footer-preview {
          background: #1a1a1a;
          border: 1px solid #333;
          color: #aaa;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-footer-preview:hover {
          background: #252525;
          color: #fff;
          border-color: #555;
        }

        .btn-footer-wa {
          background: #25D366;
          color: #fff;
          text-decoration: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s;
        }

        .btn-footer-wa:hover {
          background: #20ba59;
        }

        .btn-footer-advance {
          background: #fff;
          color: #000;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          margin-left: auto;
          transition: background 0.15s;
        }

        .btn-footer-advance:hover:not(:disabled) {
          background: #e2e8f0;
        }

        .btn-footer-cancel {
          background: transparent;
          color: #f87171;
          border: 1px solid rgba(248, 113, 113, 0.3);
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-footer-cancel:hover {
          background: rgba(248, 113, 113, 0.1);
        }

        /* Operational Emails Panel */
        .operational-emails-panel {
          background: #111;
          border: 1px solid #262626;
          border-radius: 8px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .emails-title {
          font-size: 11px;
          font-weight: 700;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .email-target {
          color: #60a5fa;
          text-transform: none;
          font-weight: 500;
        }

        .emails-grid {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn-service-email {
          background: #1e1e1e;
          border: 1px solid #333;
          color: #eee;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-service-email:hover {
          background: #2a2a2a;
          border-color: #555;
          color: #fff;
        }

        .email-cancel {
          border-color: rgba(239, 68, 68, 0.4);
          color: #fca5a5;
        }

        .email-cancel:hover {
          background: rgba(239, 68, 68, 0.15);
        }

        /* ── MODALS ── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .preview-modal {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 16px;
          width: 100%;
          max-width: 560px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7);
        }

        .cancel-modal {
          max-width: 500px;
        }

        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 18px 20px;
          border-bottom: 1px solid #262626;
        }

        .cancel-header {
          border-bottom: 1px solid rgba(239, 68, 68, 0.3);
        }

        .preview-title {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 3px;
        }

        .text-danger {
          color: #f87171;
        }

        .preview-sub {
          font-size: 12px;
          color: #888;
        }

        .close-btn {
          background: none;
          border: none;
          color: #888;
          font-size: 18px;
          cursor: pointer;
          padding: 4px;
        }

        .close-btn:hover {
          color: #fff;
        }

        .preview-body {
          flex: 1;
          overflow-y: auto;
          padding: 18px 20px;
        }

        .flex-col {
          display: flex;
          flex-direction: column;
        }

        .gap-4 {
          gap: 16px;
        }

        .message-text {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.6;
          color: #ddd;
          white-space: pre-wrap;
          word-break: break-word;
          background: #111;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 14px;
        }

        .preview-footer {
          display: flex;
          gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid #262626;
        }

        .justify-between {
          justify-content: space-between;
        }

        .btn-ghost {
          background: transparent;
          border: 1px solid #333;
          color: #aaa;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-ghost:hover {
          background: #222;
          color: #fff;
        }

        .btn-whatsapp {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #25D366;
          color: #fff;
          text-decoration: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-whatsapp-sm {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #25D366;
          color: #fff;
          text-decoration: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
        }

        .btn-danger-confirm {
          background: #DC143C;
          color: #fff;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .form-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #aaa;
          margin-bottom: 6px;
        }

        .form-select {
          width: 100%;
          background: #111;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 8px 12px;
          color: #fff;
          font-size: 13px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #ccc;
          cursor: pointer;
        }

        .checkbox-input {
          accent-color: #DC143C;
          width: 16px;
          height: 16px;
        }

        .hint-text {
          font-size: 12px;
          color: #777;
        }

        .cancel-preview-box {
          background: #111;
          border: 1px solid #262626;
          border-radius: 8px;
          padding: 12px;
        }

        .preview-box-label {
          font-size: 11px;
          color: #888;
          margin-bottom: 6px;
        }

        .preview-box-text {
          font-size: 11px;
          color: #666;
          white-space: pre-wrap;
          max-height: 80px;
          overflow-y: auto;
          background: #0d0d0d;
          padding: 8px;
          border-radius: 4px;
        }

        .mt-2 { margin-top: 8px; }

        .create-modal {
          max-width: 680px;
        }

        .create-modal-body {
          padding: 20px;
          overflow-y: auto;
          max-height: calc(85vh - 130px);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-section {
          background: #181818;
          border: 1px solid #282828;
          border-radius: 10px;
          padding: 14px;
        }

        .form-section-title {
          font-size: 13px;
          font-weight: 700;
          color: #eee;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .form-row-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        @media (max-width: 640px) {
          .form-row-grid {
            grid-template-columns: 1fr;
          }
        }

        .form-input {
          width: 100%;
          background: #111;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 8px 12px;
          color: #fff;
          font-size: 13px;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.15s ease;
        }

        .form-input:focus {
          border-color: #DC143C;
        }

        .create-summary-card {
          background: #111;
          border: 1px solid rgba(220, 20, 60, 0.4);
          border-radius: 10px;
          padding: 14px;
        }
      `}</style>
    </div>
  )
}
