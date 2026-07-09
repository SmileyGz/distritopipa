export interface OrderForMessage {
  order_number: string; customer_name: string; customer_phone: string
  items: Array<{name:string;qty:number;unit_price:number;color?:string;bundle_qty?:number;bundle_price?:number}>
  subtotal_mxn: number; delivery_fee: number; total_mxn: number; anticipo_mxn: number
  delivery_mode: 'pickup'|'delivery'|'punto_medio'; delivery_zone?: string
  is_night?: boolean; payment_mode: 'deposit'|'pickup_cash'|'full_prepay'
  delivery_address?: string; scheduled_at?: string
}

const CLABE = '1676 9100 0009 7700 36'

function formatMXN(n: number) { return `$${n.toLocaleString('es-MX', {minimumFractionDigits:0})} MXN` }

function formatItems(items: OrderForMessage['items']): string {
  return items.map(i => {
    const bundle = i.bundle_qty ? ` (pack ${i.bundle_qty}x)` : ''
    const color  = i.color ? ` — ${i.color}` : ''
    const price  = i.bundle_price ?? i.unit_price * i.qty
    return `  • ${i.qty}x ${i.name}${color}${bundle} — ${formatMXN(price)}`
  }).join('\n')
}

function formatDeliveryLabel(o: OrderForMessage): string {
  if (o.delivery_mode==='pickup') return 'Recoger en Región 96 (Coppel / Soriana Nichupté)'
  if (o.delivery_mode==='punto_medio') return 'Punto medio / Plaza'
  const zone = o.delivery_zone==='zone2' ? '6–10 km' : '1–6 km'
  const night = o.is_night ? ' (nocturno después de 8pm)' : ''
  return `Envío a domicilio ${zone}${night}`
}

function depositMsg(o: OrderForMessage): string {
  const resta = o.total_mxn - o.anticipo_mxn
  return `✅ *¡Confirmamos tu pedido, ${o.customer_name}!*\n\n🧾 *Pedido ${o.order_number}*\n${formatItems(o.items)}\n\n📦 *Subtotal:* ${formatMXN(o.subtotal_mxn)}\n🚗 *Envío:* ${formatMXN(o.delivery_fee)}\n💰 *TOTAL:* ${formatMXN(o.total_mxn)}\n\n━━━━━━━━━━━━━━━━━━━\n📍 *Entrega:* ${formatDeliveryLabel(o)}${o.delivery_address?'\n📌 Dirección: '+o.delivery_address:''}\n\n━━━━━━━━━━━━━━━━━━━\n💳 *Anticipo requerido: ${formatMXN(o.anticipo_mxn)}*\n\nTransfiere a esta CLABE:\n\`${CLABE}\`\n\n📝 *Referencia:* ${o.order_number}\n\n⚠️ Una vez recibido el anticipo, preparamos tu pedido.\nEl resto (${formatMXN(resta)}) lo pagas al momento de la entrega en efectivo.\n\n━━━━━━━━━━━━━━━━━━━\n_Accesorios de uso personal · Producto legal · No incluye sustancias_\n_Distrito Pipa — Cancún 🌴_`
}

function pickupCashMsg(o: OrderForMessage): string {
  return `✅ *¡Pedido separado para ti, ${o.customer_name}!*\n\n🧾 *Pedido ${o.order_number}*\n${formatItems(o.items)}\n\n💰 *TOTAL A PAGAR:* ${formatMXN(o.total_mxn)}\n💵 *Pago:* Efectivo al recoger\n\n━━━━━━━━━━━━━━━━━━━\n📍 *Punto de recogida:*\nRegión 96, Cancún\n(Cerca de Coppel y Soriana Nichupté)\n\n📅 Coordina tu horario respondiendo este mensaje.\n\n━━━━━━━━━━━━━━━━━━━\n_Accesorios de uso personal · Producto legal · No incluye sustancias_\n_Distrito Pipa — Cancún 🌴_`
}

function fullPrepayMsg(o: OrderForMessage): string {
  return `✅ *¡Pedido confirmado, ${o.customer_name}!*\n\n🧾 *Pedido ${o.order_number}*\n${formatItems(o.items)}\n\n📦 *Subtotal:* ${formatMXN(o.subtotal_mxn)}\n🚗 *Envío:* ${formatMXN(o.delivery_fee)}\n💰 *TOTAL:* ${formatMXN(o.total_mxn)}\n\n━━━━━━━━━━━━━━━━━━━\n📍 *Entrega:* ${formatDeliveryLabel(o)}${o.delivery_address?'\n📌 Dirección: '+o.delivery_address:''}\n\n━━━━━━━━━━━━━━━━━━━\n💳 *Pago completo: ${formatMXN(o.total_mxn)}*\n\nTransfiere a esta CLABE:\n\`${CLABE}\`\n\n📝 *Referencia:* ${o.order_number}\n\n⚠️ En cuanto confirmemos tu transferencia, preparamos y enviamos tu pedido.\n\n━━━━━━━━━━━━━━━━━━━\n_Accesorios de uso personal · Producto legal · No incluye sustancias_\n_Distrito Pipa — Cancún 🌴_`
}

export function buildConfirmationUrl(o: OrderForMessage): string {
  let msg: string
  switch(o.payment_mode) {
    case 'pickup_cash':  msg = pickupCashMsg(o); break
    case 'full_prepay':  msg = fullPrepayMsg(o); break
    default:             msg = depositMsg(o)
  }
  const phone = o.customer_phone.replace(/\D/g,'')
  const full = phone.startsWith('52') ? phone : `52${phone}`
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`
}

export function buildConfirmationText(o: OrderForMessage): string {
  switch(o.payment_mode) {
    case 'pickup_cash':  return pickupCashMsg(o)
    case 'full_prepay':  return fullPrepayMsg(o)
    default:             return depositMsg(o)
  }
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
  pickup:      '📍 Recoger en tienda',
  delivery:    '🚗 Envío a domicilio',
  punto_medio: '🏢 Punto medio',
}
