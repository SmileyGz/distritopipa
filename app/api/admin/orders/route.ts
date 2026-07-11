import { NextResponse, NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function checkAuth(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  return secret === process.env.NEXT_PUBLIC_ADMIN_SECRET
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
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
    order_number: o.id.split('-')[0].toUpperCase(),
    status: o.status === 'new' ? 'pending' : o.status,
    customer_name: o.customers?.first_name || 'Desconocido',
    customer_phone: o.customers?.phone || '',
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
    created_at: o.created_at,
    updated_at: o.updated_at,
  }))

  return NextResponse.json({ orders: mappedOrders })
}

export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) {
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

    const { error } = await supabaseAdmin
      .from('orders')
      .update(dbUpdates)
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
