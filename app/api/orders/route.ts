// app/api/orders/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/orders
// Creates a booking order and returns payment instructions.
// Flow:
//   1. Customer selects products + delivery zone on the shelf
//   2. POST here with cart + contact info
//   3. We calculate anticipo (25% of total)
//   4. Return CLABE + amount for bank transfer, or Clip payment link
//   5. Webhook from payment provider hits PATCH /api/orders/:id/confirm
//   6. Confirmed order triggers WhatsApp contact from you
// ─────────────────────────────────────────────────────────────

import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { sendEmail } from '@/lib/email'
import { getBrandedEmailHtml } from '@/lib/email-templates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy'
)

type CartItem = {
  product_id: string
  name: string
  qty: number
  unit_price: number
  color?: string
  bundle_qty?: number  // if customer selected 2x or 3x bundle
}

type OrderBody = {
  items: CartItem[]
  delivery_zone: 'pickup' | 'zone1' | 'zone2' | 'punto_medio'
  customer_name: string
  customer_phone: string     // WhatsApp number
  customer_email?: string
  delivery_address?: string
  delivery_notes?: string
  is_night?: boolean         // after 8pm flag
  payment_preference?: 'anticipo' | 'total'
}

export async function POST(req: NextRequest) {
  let body: OrderBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
  }

  const {
    items,
    delivery_zone,
    customer_name,
    customer_phone,
    customer_email,
    delivery_address,
    delivery_notes,
    is_night = false,
    payment_preference = 'anticipo',
  } = body

  // Validate
  if (!items?.length) return NextResponse.json({ error: 'Carrito vacío.' }, { status: 400 })
  if (!customer_phone) return NextResponse.json({ error: 'Teléfono requerido.' }, { status: 400 })
  if (!delivery_zone) return NextResponse.json({ error: 'Selecciona opción de entrega.' }, { status: 400 })

  // Calculate totals (respect bundle discounts if they exist)
  const subtotal = items.reduce((sum: number, item: any) => {
    if (item.bundle_price !== undefined) {
      return sum + item.bundle_price
    }
    return sum + (item.unit_price * item.qty)
  }, 0)
  let delivery_fee = 0
  if (delivery_zone !== 'pickup') {
    if (is_night) {
      delivery_fee = delivery_zone === 'zone1' ? 80 : 100
    } else {
      delivery_fee = delivery_zone === 'zone1' ? 50 : 80
    }
  }
  const total = subtotal + delivery_fee
  
  // Amount to charge via MP
  let anticipo = delivery_zone === 'pickup' ? 0 : 50
  if (payment_preference === 'total') {
    anticipo = total
  }

  // Upsert customer (create or find by phone)
  let customer = null
  try {
    const { data: existing } = await supabase
      .from('customers')
      .select('id, current_tier_id')
      .eq('phone', customer_phone)
      .single()

    if (existing) {
      customer = existing
      // Opt: update their latest name
      await supabase.from('customers').update({ first_name: customer_name }).eq('id', existing.id)
    } else {
      const { data: newCust, error: insErr } = await supabase
        .from('customers')
        .insert({
          phone: customer_phone,
          first_name: customer_name,
          email: customer_email,
        })
        .select('id, current_tier_id')
        .single()
      
      if (insErr) throw insErr
      customer = newCust
    }
  } catch (err) {
    console.error('Customer lookup/insert error:', err)
  }

  // Create the order
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      customer_id: customer?.id,
      customer_email,
      items,
      subtotal,
      delivery_zone,
      delivery_address,
      is_night,
      delivery_fee,
      total,
      payment_mode: payment_preference === 'total' ? 'full_prepay' : (delivery_zone === 'pickup' ? 'pickup_cash' : 'deposit'),
      anticipo_amount: anticipo,
      anticipo_status: 'pending',
      fulfillment_type: delivery_zone === 'pickup' ? 'pickup' : 'delivery',
      status: 'new',
    })
    .select('id, order_number, created_at')
    .single()

  if (error) {
    console.error('Order creation error:', error)
    return NextResponse.json({ error: 'Error al crear pedido. Intenta de nuevo.', sb_error: error.message }, { status: 500 })
  }

  // Automatically send Pre-Confirmation Email if they provided one
  if (customer_email) {
    const amountToPay = (payment_preference === 'total' ? total : anticipo).toLocaleString('es-MX')
    const subject = `Tu pedido está casi listo 🤝 - Pedido ${order.order_number}`
    const content = `
      <p>¡Qué onda ${customer_name}! Gracias por armar tu pedido con Distrito Pipa.</p>
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
    const html = getBrandedEmailHtml('Instrucciones de Pago', content)
    await sendEmail({ to: customer_email, subject, html }).catch(console.error)
  }

  // --- MercadoPago Integration ---
  let mpInitPoint = null
  let mpErrorMessage = null
  if (anticipo > 0) {
    try {
      const { MercadoPagoConfig, Preference } = require('mercadopago')
      // Initialize the MercadoPago client
      const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '' })
      const preference = new Preference(client)
      
      // We enforce the calculated anticipo
      const result = await preference.create({
        body: {
          items: [
            {
              id: order.id,
              title: payment_preference === 'total' ? 'Pedido Completo - Distrito Pipa' : 'Anticipo de Orden - Distrito Pipa',
              quantity: 1,
              unit_price: anticipo,
              currency_id: 'MXN'
            }
          ],
          back_urls: {
            success: 'https://www.distritopipa.com/checkout/success',
            failure: 'https://www.distritopipa.com/checkout',
            pending: 'https://www.distritopipa.com/checkout/success'
          },
          auto_return: 'approved',
          external_reference: order.id,
        }
      })
      
      mpInitPoint = result.init_point
    } catch (mpError: any) {
      console.error('MercadoPago error:', mpError)
      mpErrorMessage = mpError.message || 'Error desconocido de MercadoPago'
      // We do not fail the order creation, just fallback to standard response
    }
  }

  // Return everything the frontend needs to show the payment instructions
  return NextResponse.json({
    success: true,
    order_id: order.id,
    init_point: mpInitPoint, // The URL to redirect the user to
    mp_error: mpErrorMessage,
    summary: {
      subtotal,
      delivery_fee,
      total,
      anticipo,
      delivery_zone,
    },
    payment: {
      clabe: process.env.CLABE_NUMBER || '167691000009770036',
      recipient: 'Distrito Pipa',
      amount: anticipo,
      reference: order.order_number, // using branded order number
      instructions_es: `Transfiere $${anticipo} MXN a la CLABE indicada. Usa la referencia ${order.order_number} como concepto. Una vez confirmado el anticipo, te contactaremos por WhatsApp al ${customer_phone}.`,
    },
    customer_tier: customer?.current_tier_id || 'bronze',
    estimated_points: Math.floor(total), // points they'll earn on delivery
  })
}

// PATCH /api/orders/:id/confirm
// Called by your payment webhook (Clip, Conekta, MercadoPago)
// Marks anticipo as paid → triggers WhatsApp contact flow
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { order_id, payment_reference, gateway } = body

  if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 })

  const { error } = await supabase
    .from('orders')
    .update({
      anticipo_status: 'paid',
      anticipo_ref: payment_reference,
      status: 'confirmed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // TODO: Trigger WhatsApp Business API message to customer
  // For now: the admin dashboard shows confirmed orders for manual WhatsApp follow-up
  // When you're ready for automation, integrate Twilio or Meta Cloud API here:
  //
  // await fetch('https://api.twilio.com/...', {
  //   method: 'POST',
  //   body: `To=whatsapp:${customerPhone}&From=whatsapp:${TWILIO_NUMBER}&Body=...`
  // })

  return NextResponse.json({ success: true })
}
