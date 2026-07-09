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

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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
  } = body

  // Validate
  if (!items?.length) return NextResponse.json({ error: 'Carrito vacío.' }, { status: 400 })
  if (!customer_phone) return NextResponse.json({ error: 'Teléfono requerido.' }, { status: 400 })
  if (!delivery_zone) return NextResponse.json({ error: 'Selecciona opción de entrega.' }, { status: 400 })

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.qty, 0)
  const delivery_fee = delivery_zone === 'pickup' ? 0 : is_night ? 100 : delivery_zone === 'zone1' ? 40 : 60
  const total = subtotal + delivery_fee
  const anticipo = 50 // Fixed $50 anticipo per founder request

  // Upsert customer (create or find by phone)
  let customer = null
  try {
    const { data } = await supabase
      .from('customers')
      .upsert(
        {
          id: crypto.randomUUID(), // Provide ID if inserting new
          phone: customer_phone,
          first_name: customer_name,
          email: customer_email,
        },
        { onConflict: 'phone', ignoreDuplicates: false }
      )
      .select('id, current_tier_id')
      .single()
    customer = data
  } catch (err) {
    console.error('Customer upsert error:', err)
  }

  // Create the order
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      customer_id: customer?.id,
      items,
      subtotal,
      delivery_zone,
      delivery_fee,
      total,
      anticipo_amount: anticipo,
      anticipo_status: 'pending',
      fulfillment_type: delivery_zone === 'pickup' ? 'pickup' : 'delivery',
      status: 'new',
    })
    .select('id, created_at')
    .single()

  if (error) {
    console.error('Order creation error:', error)
    return NextResponse.json({ error: 'Error al crear pedido. Intenta de nuevo.' }, { status: 500 })
  }

  // --- MercadoPago Integration ---
  let mpInitPoint = null
  try {
    const { MercadoPagoConfig, Preference } = require('mercadopago')
    // Initialize the MercadoPago client
    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '' })
    const preference = new Preference(client)
    
    // We enforce exactly 50 MXN as the anticipo per the founder's requirement
    const result = await preference.create({
      body: {
        items: [
          {
            id: order.id,
            title: 'Anticipo de Orden - Distrito Pipa',
            quantity: 1,
            unit_price: 50,
            currency_id: 'MXN'
          }
        ],
        back_urls: {
          success: 'https://www.distritopipa.com/checkout/success',
          failure: 'https://www.distritopipa.com/checkout/success',
          pending: 'https://www.distritopipa.com/checkout/success'
        },
        auto_return: 'approved',
        external_reference: order.id,
      }
    })
    
    mpInitPoint = result.init_point
  } catch (mpError) {
    console.error('MercadoPago error:', mpError)
    // We do not fail the order creation, just fallback to standard response
  }

  // Return everything the frontend needs to show the payment instructions
  return NextResponse.json({
    success: true,
    order_id: order.id,
    init_point: mpInitPoint, // The URL to redirect the user to
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
      reference: order.id.slice(0, 8).toUpperCase(), // short order ref for bank transfer
      instructions_es: `Transfiere $${anticipo} MXN a la CLABE indicada. Usa la referencia ${order.id.slice(0,8).toUpperCase()} como concepto. Una vez confirmado el anticipo, te contactaremos por WhatsApp al ${customer_phone}.`,
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
      anticipo_paid: true,
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
