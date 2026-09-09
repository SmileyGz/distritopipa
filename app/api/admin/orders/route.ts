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
    .select('*, customers (first_name, phone)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Translate the database schema into the frontend schema expected by the admin dashboard
  const mappedOrders = data.map((o: any) => ({
    id: o.id,
    order_number: o.order_number || o.id.split('-')[0].toUpperCase(),
    status: o.status === 'new' ? 'pending' : o.status,
    customer_name: o.customers?.first_name || 'Desconocido',
    customer_phone: o.customers?.phone || '',
    customer_email: o.customer_email || '',
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
    delivery_address: o.delivery_address || '',
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
        if (order.fulfillment_type === 'pickup') {
          if (order.payment_mode === 'full_prepay') {
            copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${orderNumber}</strong> está 100% confirmado y pagado. Cero sorpresas.</p>
                        <p>Tu paquete ya te está esperando. Si ya nos contactaste por WhatsApp, en breve te pasaremos las coordenadas exactas de nuestro spot y nos pondremos de acuerdo para tu recolección.</p>`
          } else {
            copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${orderNumber}</strong> está confirmado gracias a tu anticipo. Cero sorpresas.</p>
                        <p>Tu paquete ya te está esperando; recuerda que <strong>el saldo pendiente se liquida en efectivo al momento de recolectarlo</strong>.</p>
                        <p>Si ya nos contactaste por WhatsApp, en breve te pasaremos las coordenadas exactas de nuestro spot y nos pondremos de acuerdo para tu recolección.</p>
                        <p><em>¿Ocupas cambio? (avísanos con tiempo porfa si necesitas cambio de algún billete)</em></p>`
          }
        } else {
          if (order.payment_mode === 'full_prepay') {
            copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${orderNumber}</strong> está 100% confirmado y pagado. Cero sorpresas.</p>
                        <p>Seguimos moviéndonos por Cancún para entregarte rápido. Si ya nos mandaste tu ubicación por WhatsApp, en breve armamos la ruta y afinamos detalles.</p>`
          } else {
            copyBody = `<p>Tus piezas ya están separadas y tu pedido <strong>${orderNumber}</strong> está confirmado gracias a tu anticipo. Cero sorpresas.</p>
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

        const anticipoPaid = isFullPrepay ? (order.total_mxn || 0) : (order.anticipo_mxn || 50)
        
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
