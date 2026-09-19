import { NextResponse, NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { getBrandedEmailHtml, renderOrderSummaryHtml } from '@/lib/email-templates'

import { isValidAdminRequest } from '@/lib/auth'

async function checkAuth(req: NextRequest) {
  return isValidAdminRequest(req)
}

export async function GET(req: NextRequest) {
  if (!await checkAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, customers (id, first_name, phone, email)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Translate the database schema into the frontend schema expected by the admin dashboard
  const mappedOrders = data.map((o: any) => ({
    id: o.id,
    order_number: o.order_number || o.id.split('-')[0].toUpperCase(),
    status: o.status === 'new' ? 'pending' : o.status,
    customer_name: o.customers?.first_name || o.customer_name || 'Desconocido',
    customer_phone: o.customers?.phone || o.customer_phone || '',
    customer_email: o.customer_email || o.customers?.email || '',
    items: o.items || [],
    subtotal_mxn: o.subtotal || 0,
    delivery_fee: o.delivery_fee || 0,
    total_mxn: o.total || 0,
    anticipo_mxn: o.anticipo_amount || 0,
    anticipo_paid: o.anticipo_status === 'paid',
    full_paid: false,
    delivery_mode: o.fulfillment_type || 'delivery',
    delivery_zone: o.delivery_zone || '',
    is_night: !!o.is_night,
    payment_mode: o.payment_mode || (o.fulfillment_type === 'pickup' ? 'pickup_cash' : 'deposit'),
    delivery_address: (o.delivery_address || '').replace(/\[Notas:\s*[\s\S]*?\]/, '').trim(),
    customer_notes: o.delivery_notes || o.customer_notes || (o.delivery_address?.match(/\[Notas:\s*([\s\S]*?)\]/)?.[1]) || '',
    delivery_notes: o.delivery_notes || o.customer_notes || (o.delivery_address?.match(/\[Notas:\s*([\s\S]*?)\]/)?.[1]) || '',
    admin_notes: o.admin_notes || '',
    payment_link: o.payment_link || null,
    created_at: o.created_at,
    updated_at: o.updated_at,
  }))

  return NextResponse.json({ orders: mappedOrders })
}

export async function PATCH(req: NextRequest) {
  if (!await checkAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { id, updates } = body

    if (!id || !updates) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    // Map frontend updates to database schema
    const dbUpdates: any = {}
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.anticipo_paid !== undefined) dbUpdates.anticipo_status = updates.anticipo_paid ? 'paid' : 'pending'
    if (updates.admin_notes !== undefined) dbUpdates.admin_notes = updates.admin_notes

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*, customers(first_name)')
      .eq('id', id)
      .single()

    const { error } = await supabaseAdmin
      .from('orders')
      .update(dbUpdates)
      .eq('id', id)

    if (error) throw error

    // Automation logic
    if (order && order.customer_email) {
      // ONLY trigger the email when the payment status changes to prevent double emails
      const isNewlyPaid = updates.anticipo_paid === true && order.anticipo_status !== 'paid'
      
      if (isNewlyPaid) {
        const orderNumber = order.order_number || order.id.split('-')[0].toUpperCase()
        const customerName = order.customers?.first_name || order.customer_name || 'Desconocido'
        
        const isFullPrepay = order.payment_mode === 'full_prepay'
        const subject = isFullPrepay 
          ? `¡Pago 100% Confirmado! - Pedido ${orderNumber}`
          : `¡Anticipo Recibido! - Pedido ${orderNumber}`
        let copyBody = ''
        const isPickup = order.fulfillment_type === 'pickup' || order.delivery_mode === 'pickup'
        if (isPickup) {
          if (isFullPrepay) {
            copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${orderNumber}</strong> está 100% confirmado y pagado. Cero sorpresas.</p>
                        <p>Tu paquete ya te está esperando. En breve te pasaremos las coordenadas exactas de nuestro spot y nos pondremos de acuerdo para tu recolección.</p>`
          } else {
            copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${orderNumber}</strong> está confirmado gracias a tu anticipo. Cero sorpresas.</p>
                        <p>Tu paquete ya te está esperando; recuerda que <strong>el saldo pendiente se liquida en efectivo al momento de recolectarlo</strong>.</p>
                        <p>En breve te pasaremos las coordenadas exactas de nuestro spot y nos pondremos de acuerdo para tu recolección.</p>`
          }
        } else {
          if (isFullPrepay) {
            copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${orderNumber}</strong> está 100% confirmado y pagado. Cero sorpresas.</p>
                        <p>Seguimos moviéndonos por Cancún para entregarte rápido. En breve armamos la ruta y afinamos detalles.</p>`
          } else {
            copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${orderNumber}</strong> está confirmado gracias a tu anticipo. Cero sorpresas.</p>
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

        const subtotal = order.subtotal ?? order.subtotal_mxn ?? 0
        const total = order.total ?? order.total_mxn ?? 0
        const deliveryFee = order.delivery_fee ?? 0
        const anticipoPaid = isFullPrepay ? total : (order.anticipo_amount ?? order.anticipo_mxn ?? 50)
        
        const orderSummaryHtml = renderOrderSummaryHtml({
          items: items.map((item: any) => ({
            name: item.name,
            title: item.title,
            quantity: item.qty || item.quantity || 1,
            price: item.unit_price || item.price || 0,
            bundle_price: item.bundle_price,
            total_price: item.bundle_price ?? ((item.unit_price || item.price || 0) * (item.qty || item.quantity || 1))
          })),
          subtotal,
          deliveryFee,
          total,
          anticipoPaid
        })

        const content = `
          <p>¡Listo ${customerName.split(' ')[0]}! Ya nos cayó tu pago. Gracias por la confianza.</p>
          ${copyBody}
          ${orderSummaryHtml}
          <p>Mientras empaquetamos tus cosas en nuestra bolsa Kraft, siéntete libre de ver lo que andan armando tus vecinos en nuestro Instagram (<a href="https://instagram.com/distritopipa" target="_blank">@distritopipa</a>) o en nuestro <a href="https://www.facebook.com/distritopipacancun/" target="_blank">Facebook</a>.</p>
          <p>¡Aquí andamos para cualquier cosa!</p>
        `
        const headerTitle = isFullPrepay ? 'Pago 100% Confirmado' : 'Anticipo Recibido'
        const html = getBrandedEmailHtml(headerTitle, content)
        
        sendEmail({ to: order.customer_email, subject, html }).catch(console.error)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!await checkAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      customer_name,
      customer_phone,
      customer_email,
      items,
      delivery_mode = 'delivery',
      delivery_zone = 'zone1',
      delivery_address = '',
      delivery_notes = '',
      customer_notes = '',
      admin_notes = '',
      is_night = false,
      subtotal_mxn,
      delivery_fee,
      total_mxn,
      anticipo_mxn,
      anticipo_paid = false,
      payment_mode = 'deposit',
      status = 'confirmed',
      send_email = false,
    } = body

    if (!customer_name?.trim()) {
      return NextResponse.json({ error: 'El nombre del cliente es obligatorio' }, { status: 400 })
    }
    if (!customer_phone?.trim()) {
      return NextResponse.json({ error: 'El teléfono del cliente es obligatorio' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Debes incluir al menos un artículo en el pedido' }, { status: 400 })
    }

    // Calculate subtotal
    const calculatedSubtotal = subtotal_mxn !== undefined
      ? Number(subtotal_mxn)
      : items.reduce((sum: number, it: any) => {
          const qty = Number(it.qty) || 1
          const unitPrice = Number(it.unit_price) || 0
          const itemTotal = it.bundle_price !== undefined && it.bundle_price > 0
            ? Number(it.bundle_price)
            : unitPrice * qty
          return sum + itemTotal
        }, 0)

    // Calculate delivery fee
    let calculatedDeliveryFee = delivery_fee !== undefined ? Number(delivery_fee) : 0
    if (delivery_fee === undefined) {
      if (delivery_mode === 'pickup') {
        calculatedDeliveryFee = 0
      } else if (delivery_zone === 'zone2') {
        calculatedDeliveryFee = is_night ? 100 : 80
      } else if (delivery_zone === 'zone1') {
        calculatedDeliveryFee = is_night ? 80 : 50
      } else {
        calculatedDeliveryFee = 0
      }
    }

    // Calculate total
    const calculatedTotal = total_mxn !== undefined
      ? Number(total_mxn)
      : calculatedSubtotal + calculatedDeliveryFee

    // Calculate anticipo
    let calculatedAnticipo = anticipo_mxn !== undefined ? Number(anticipo_mxn) : 0
    if (anticipo_mxn === undefined) {
      if (payment_mode === 'full_prepay') {
        calculatedAnticipo = calculatedTotal
      } else if (delivery_mode === 'pickup') {
        calculatedAnticipo = 0
      } else {
        calculatedAnticipo = 50
      }
    }

    // Upsert customer by phone
    let customer: any = null
    const cleanPhone = customer_phone.trim().replace(/\D/g, '') || customer_phone.trim()
    try {
      const { data: existingCust } = await supabaseAdmin
        .from('customers')
        .select('id, first_name, phone, email')
        .or(`phone.eq.${cleanPhone},phone.eq.${customer_phone.trim()}`)
        .maybeSingle()

      if (existingCust) {
        customer = existingCust
        const updates: Record<string, any> = { first_name: customer_name.trim() }
        if (customer_email?.trim()) updates.email = customer_email.trim()
        await supabaseAdmin.from('customers').update(updates).eq('id', existingCust.id)
      } else {
        const { data: newCust, error: insCustErr } = await supabaseAdmin
          .from('customers')
          .insert({
            phone: cleanPhone,
            first_name: customer_name.trim(),
            email: customer_email?.trim() || null,
          })
          .select('id')
          .single()

        if (!insCustErr && newCust) {
          customer = newCust
        }
      }
    } catch (custErr) {
      console.error('Admin order: error resolving customer:', custErr)
    }

    const rawNotes = (delivery_notes || customer_notes || '').trim()
    const allNotesParts: string[] = []
    if (rawNotes) allNotesParts.push(`Notas: ${rawNotes}`)
    if (admin_notes?.trim()) allNotesParts.push(`Admin: ${admin_notes.trim()}`)
    const notesJoined = allNotesParts.join(' | ')

    const addressWithNotes = notesJoined
      ? (delivery_address.trim() ? `${delivery_address.trim()} [${notesJoined}]` : `[${notesJoined}]`)
      : delivery_address.trim()

    const baseOrderData: Record<string, any> = {
      customer_id: customer?.id || null,
      customer_email: customer_email?.trim() || null,
      items,
      subtotal: calculatedSubtotal,
      delivery_fee: calculatedDeliveryFee,
      total: calculatedTotal,
      fulfillment_type: delivery_mode === 'pickup' ? 'pickup' : 'delivery',
      delivery_zone: delivery_mode === 'pickup' ? 'pickup' : (delivery_zone || 'zone1'),
      delivery_address: addressWithNotes,
      is_night: !!is_night,
      payment_mode: payment_mode || (delivery_mode === 'pickup' ? 'pickup_cash' : 'deposit'),
      anticipo_amount: calculatedAnticipo,
      anticipo_status: anticipo_paid ? 'paid' : 'pending',
      status: status || 'confirmed',
    }

    let orderResult: any = null
    let orderError: any = null

    // Attempt 1: Try with delivery_notes and/or admin_notes if present
    const payloadWithOptionalNotes: Record<string, any> = { ...baseOrderData }
    if (rawNotes) payloadWithOptionalNotes.delivery_notes = rawNotes
    if (admin_notes?.trim()) payloadWithOptionalNotes.admin_notes = admin_notes.trim()

    const attempt1 = await supabaseAdmin
      .from('orders')
      .insert(payloadWithOptionalNotes)
      .select('id, order_number, created_at')
      .single()

    orderResult = attempt1.data
    orderError = attempt1.error

    // Attempt 2: If attempt 1 failed due to missing column (e.g. delivery_notes or admin_notes) or schema cache
    if (orderError && (orderError.message.includes('schema cache') || orderError.message.includes('column') || !orderResult)) {
      console.warn('Orders table missing optional columns. Falling back to baseOrderData...', orderError?.message)
      const attempt2 = await supabaseAdmin
        .from('orders')
        .insert(baseOrderData)
        .select('id, order_number, created_at')
        .single()

      orderResult = attempt2.data
      orderError = attempt2.error
    }

    // Attempt 3: If attempt 2 failed due to status check constraint (e.g., table only accepts 'new')
    if (orderError && (orderError.message.includes('status') || !orderResult)) {
      console.warn('Status constraint triggered. Falling back with status "new"...', orderError?.message)
      const attempt3 = await supabaseAdmin
        .from('orders')
        .insert({
          ...baseOrderData,
          status: 'new',
        })
        .select('id, order_number, created_at')
        .single()

      orderResult = attempt3.data
      orderError = attempt3.error
    }

    if (orderError || !orderResult) {
      console.error('Admin order creation error:', orderError)
      return NextResponse.json({
        error: 'Error al registrar pedido en la base de datos',
        details: orderError?.message || orderError?.details || orderError?.hint || JSON.stringify(orderError)
      }, { status: 500 })
    }

    const createdOrder = orderResult
    const mappedOrder = {
      id: createdOrder.id,
      order_number: createdOrder.order_number || createdOrder.id.split('-')[0].toUpperCase(),
      status: createdOrder.status === 'new' ? 'pending' : (createdOrder.status || status || 'confirmed'),
      customer_name: customer_name.trim(),
      customer_phone: cleanPhone,
      customer_email: customer_email?.trim() || '',
      items: items,
      subtotal_mxn: calculatedSubtotal,
      delivery_fee: calculatedDeliveryFee,
      total_mxn: calculatedTotal,
      anticipo_mxn: calculatedAnticipo,
      anticipo_paid: !!anticipo_paid,
      full_paid: payment_mode === 'full_prepay' && !!anticipo_paid,
      delivery_mode: delivery_mode,
      delivery_zone: delivery_mode === 'pickup' ? 'pickup' : (delivery_zone || 'zone1'),
      is_night: !!is_night,
      payment_mode: payment_mode,
      delivery_address: delivery_address.trim(),
      customer_notes: rawNotes,
      delivery_notes: rawNotes,
      admin_notes: admin_notes?.trim() || '',
      payment_link: null,
      created_at: createdOrder.created_at || new Date().toISOString(),
      updated_at: createdOrder.created_at || new Date().toISOString(),
    }

    // Optional email confirmation if customer provided email and send_email is true
    if (send_email && customer_email?.trim()) {
      try {
        const orderNumber = mappedOrder.order_number
        const isFullPrepay = mappedOrder.payment_mode === 'full_prepay'
        const subject = isFullPrepay
          ? `¡Pago 100% Confirmado! - Pedido ${orderNumber}`
          : `¡Pedido Confirmado! - Pedido ${orderNumber}`

        const isPickup = mappedOrder.delivery_mode === 'pickup'
        const copyBody = isPickup
          ? `<p>Tus piezas ya están apartadas para ti en nuestro punto de entrega (Región 96, Cancún). En breve coordinamos tu horario de entrega.</p>`
          : `<p>Tus piezas ya están apartadas para ti y tu pedido <strong>${orderNumber}</strong> está confirmado. En breve preparamos tu ruta.</p>`

        const orderSummaryHtml = renderOrderSummaryHtml({
          items: items.map((item: any) => ({
            name: item.name,
            title: item.name,
            quantity: item.qty || 1,
            price: item.unit_price || 0,
            bundle_price: item.bundle_price,
            total_price: item.bundle_price ?? ((item.unit_price || 0) * (item.qty || 1))
          })),
          subtotal: calculatedSubtotal,
          deliveryFee: calculatedDeliveryFee,
          total: calculatedTotal,
          anticipoPaid: mappedOrder.anticipo_paid ? (isFullPrepay ? calculatedTotal : calculatedAnticipo) : 0
        })

        const content = `
          <p>¡Hola ${customer_name.trim().split(' ')[0]}! Registramos tu pedido con éxito.</p>
          ${copyBody}
          ${orderSummaryHtml}
          <p>Cualquier duda o cambio, escríbenos directamente por WhatsApp al <a href="https://wa.me/529983973410">+52 998 397 3410</a>.</p>
        `
        const headerTitle = isFullPrepay ? 'Pago 100% Confirmado' : 'Pedido Confirmado'
        const html = getBrandedEmailHtml(headerTitle, content)
        sendEmail({ to: customer_email.trim(), subject, html }).catch(console.error)
      } catch (emErr) {
        console.error('Error sending admin order confirmation email:', emErr)
      }
    }

    return NextResponse.json({ success: true, order: mappedOrder })
  } catch (err: any) {
    console.error('POST /api/admin/orders error:', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}

