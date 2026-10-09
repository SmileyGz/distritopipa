export interface OrderForMessage {
  order_number: string; customer_name: string; customer_phone: string
  items: Array<{name:string;qty:number;unit_price:number;color?:string;bundle_qty?:number;bundle_price?:number}>
  subtotal_mxn: number; delivery_fee: number; total_mxn: number; anticipo_mxn: number
  delivery_mode: 'pickup'|'delivery'; delivery_zone?: string
  is_night?: boolean; payment_mode: 'deposit'|'pickup_cash'|'full_prepay'
  delivery_address?: string; scheduled_at?: string
}

import { BANK_CONFIG } from '@/lib/config'

const CLABE = BANK_CONFIG.formattedClabe

function formatMXN(n: number) { return `$${(n || 0).toLocaleString('es-MX', {minimumFractionDigits:0})} MXN` }

function formatItems(items: OrderForMessage['items']): string {
  if (!items || items.length === 0) return '  - Artículos'
  return items.map(i => {
    const bundle = i.bundle_qty ? ` (Pack ${i.bundle_qty}x)` : ''
    const color  = i.color ? ` (${i.color})` : ''
    const price  = i.bundle_price ?? (i.unit_price * (i.qty || 1))
    return `  - ${i.qty || 1}x ${i.name}${color}${bundle} — ${formatMXN(price)}`
  }).join('\n')
}

export function buildConfirmationText(o: OrderForMessage): string {
  const shortName = o.customer_name ? o.customer_name.trim().split(' ')[0] : 'amigo'

  // ── 1. RECOLECCIÓN / PICKUP (Región 96) ──
  if (o.delivery_mode === 'pickup') {
    if (o.payment_mode === 'full_prepay') {
      return `¡Hola ${shortName}! Confirmamos tu pedido en Distrito Pipa Cancún 🌴

*Pedido ${o.order_number}*
${formatItems(o.items)}

*Total:* ${formatMXN(o.total_mxn)} (Liquidado 100%)
*Punto de recolección:* Región 96, Cancún (cerca de Soriana Nichupté y Coppel)

Tus piezas ya están listas y separadas para ti.
Respóndenos a este mensaje con tu horario estimado para coordinar tu entrega personal.

_Distrito Pipa Cancún · Accesorios de uso personal_`
    }

    if (o.payment_mode === 'deposit') {
      const resta = Math.max(0, (o.total_mxn || 0) - (o.anticipo_mxn || 0))
      return `¡Hola ${shortName}! Confirmamos tu pedido en Distrito Pipa Cancún 🌴

*Pedido ${o.order_number}*
${formatItems(o.items)}

*Total:* ${formatMXN(o.total_mxn)}
*Punto de recolección:* Región 96, Cancún (cerca de Soriana Nichupté y Coppel)

*Anticipo requerido:* ${formatMXN(o.anticipo_mxn)}
Transfiere a esta CLABE:
\`${CLABE}\`
Referencia: ${o.order_number}

En cuanto confirmemos tu anticipo, separamos tus piezas. El saldo restante (${formatMXN(resta)}) lo liquidas al recoger en efectivo.
Respóndenos con tu horario estimado para coordinar.

_Distrito Pipa Cancún · Accesorios de uso personal_`
    }

    // Default pickup: Efectivo al recoger
    return `¡Hola ${shortName}! Apartamos tus piezas en Distrito Pipa Cancún 🌴

*Pedido ${o.order_number}*
${formatItems(o.items)}

*Total a pagar:* ${formatMXN(o.total_mxn)}
*Forma de pago:* Efectivo al recoger

*Punto de recolección:*
Región 96, Cancún (cerca de Soriana Nichupté y Coppel)

Tus piezas ya están separadas para ti.
Respóndenos a este mensaje con tu horario estimado para esperarte y entregártelas.

_Distrito Pipa Cancún · Accesorios de uso personal_`
  }

  // ── 2. ENVÍO A DOMICILIO (Delivery) ──
  const zoneText = o.delivery_zone === 'zone2' ? 'Zona 2 (6–10 km)' : 'Zona 1 (1–6 km)'
  const nightText = o.is_night ? ' [Nocturno +8pm]' : ''
  const addressLine = o.delivery_address ? `\n*Dirección de entrega:* ${o.delivery_address}` : ''

  if (o.payment_mode === 'full_prepay') {
    return `¡Hola ${shortName}! Confirmamos tu pedido en Distrito Pipa Cancún 🌴

*Pedido ${o.order_number}*
${formatItems(o.items)}

Subtotal: ${formatMXN(o.subtotal_mxn)}
Envío: ${formatMXN(o.delivery_fee)} (${zoneText}${nightText})
*Total pagado:* ${formatMXN(o.total_mxn)} (Liquidado 100%)${addressLine}

Tus piezas están listas. En breve te avisamos cuando el repartidor salga en ruta hacia tu ubicación.

_Distrito Pipa Cancún · Accesorios de uso personal_`
  }

  if (o.payment_mode === 'pickup_cash') {
    return `¡Hola ${shortName}! Confirmamos tu pedido en Distrito Pipa Cancún 🌴

*Pedido ${o.order_number}*
${formatItems(o.items)}

Subtotal: ${formatMXN(o.subtotal_mxn)}
Envío: ${formatMXN(o.delivery_fee)} (${zoneText}${nightText})
*Total a pagar:* ${formatMXN(o.total_mxn)}
*Forma de pago:* Efectivo al recibir con el repartidor${addressLine}

Ya estamos preparando tu paquete. En breve te avisamos en cuanto el repartidor esté en camino a tu domicilio.

_Distrito Pipa Cancún · Accesorios de uso personal_`
  }

  // Default delivery: payment_mode === 'deposit'
  const resta = Math.max(0, (o.total_mxn || 0) - (o.anticipo_mxn || 0))
  return `¡Hola ${shortName}! Confirmamos tu pedido en Distrito Pipa Cancún 🌴

*Pedido ${o.order_number}*
${formatItems(o.items)}

Subtotal: ${formatMXN(o.subtotal_mxn)}
Envío: ${formatMXN(o.delivery_fee)} (${zoneText}${nightText})
*Total:* ${formatMXN(o.total_mxn)}${addressLine}

*Anticipo para envío:* ${formatMXN(o.anticipo_mxn)}
Transfiere a esta CLABE:
\`${CLABE}\`
Referencia: ${o.order_number}

En cuanto recibamos tu comprobante de anticipo, preparamos tu pedido y sale a ruta.
El saldo restante (${formatMXN(resta)}) lo liquidas en efectivo con el repartidor al recibir.

_Distrito Pipa Cancún · Accesorios de uso personal_`
}

export function buildConfirmationUrl(o: OrderForMessage): string {
  const msg = buildConfirmationText(o)
  const phone = (o.customer_phone || '').replace(/\D/g, '')
  const full = phone.startsWith('52') ? phone : `52${phone}`
  return `https://api.whatsapp.com/send?phone=${full}&text=${encodeURIComponent(msg)}`
}

export function buildCancellationText(o: OrderForMessage): string {
  const shortName = o.customer_name ? o.customer_name.trim().split(' ')[0] : 'amigo'
  return `¡Hola ${shortName}! 👋

Te avisamos de Distrito Pipa que, como no registramos el anticipo de tu pedido *${o.order_number}*, tuvimos que liberar las piezas de tu apartado para que vuelvan a estar disponibles en catálogo.

Entendemos que a veces se complican los tiempos o cambian los planes, ¡cero broncas! 🤝

Si realizaste tu transferencia hace un momento o deseas rearmar tu pedido más adelante, solo respóndenos por aquí y con gusto te atendemos.

_Distrito Pipa Cancún · Accesorios de uso personal_`
}

export function buildCancellationUrl(o: OrderForMessage): string {
  const phone = (o.customer_phone || '').replace(/\D/g, '')
  const full = phone.startsWith('52') ? phone : `52${phone}`
  const msg = buildCancellationText(o)
  return `https://api.whatsapp.com/send?phone=${full}&text=${encodeURIComponent(msg)}`
}

export function buildDeliveredText(o: OrderForMessage): string {
  const shortName = o.customer_name ? o.customer_name.trim().split(' ')[0] : 'amigo'
  if (o.delivery_mode === 'pickup') {
    return `¡Entrega confirmada, ${shortName}! ✌️

*Pedido ${o.order_number}*
${formatItems(o.items)}

Confirmamos la entrega de tu pedido en nuestro punto de encuentro (Región 96, Cancún).
Tu pedido quedó *100% liquidado*.

Muchísimas gracias por tu confianza en Distrito Pipa Cancún 🌴. Cualquier duda sobre el cuidado o uso de tus piezas, escríbenos por aquí con toda confianza.

_Distrito Pipa Cancún · Accesorios de uso personal_`
  }
  return `¡Pedido entregado con éxito, ${shortName}! 🛵💨

*Pedido ${o.order_number}*
${formatItems(o.items)}

Confirmamos la entrega de tu pedido en ${o.delivery_address || 'tu domicilio'}.
Tu pedido quedó *100% liquidado*.

Muchísimas gracias por tu compra y por apoyar el comercio local con Distrito Pipa Cancún 🌴. ¡Que disfrutes tus piezas!
Si necesitas algo más o tienes cualquier duda, estamos a la orden por aquí.

_Distrito Pipa Cancún · Accesorios de uso personal_`
}

export function buildDeliveredUrl(o: OrderForMessage): string {
  const phone = (o.customer_phone || '').replace(/\D/g, '')
  const full = phone.startsWith('52') ? phone : `52${phone}`
  const msg = buildDeliveredText(o)
  return `https://api.whatsapp.com/send?phone=${full}&text=${encodeURIComponent(msg)}`
}

export const STATUS_LABELS: Record<string,{label:string;color:string}> = {
  pending:   {label:'Pendiente',  color:'#fbbf24'},
  confirmed: {label:'Confirmado', color:'#60a5fa'},
  preparing: {label:'Preparando', color:'#a78bfa'},
  ready:     {label:'Listo',      color:'#34d399'},
  delivered: {label:'Entregado',  color:'#4ade80'},
  cancelled: {label:'Cancelado',  color:'#f87171'},
  wholesale_inquiry: {label:'Cotización Mayoreo', color:'#f59e0b'},
}

export const PAYMENT_LABELS: Record<string,string> = {
  deposit:     '💳 Anticipo + efectivo',
  pickup_cash: '💵 Efectivo al recoger',
  full_prepay: '💳 Pago completo',
}

export const DELIVERY_LABELS: Record<string,string> = {
  pickup:      '📍 Pickup en Región 96',
  delivery:    '🚗 Envío a domicilio',
}
