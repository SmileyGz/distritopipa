import { NextResponse, NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function checkAuth(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  return secret === process.env.NEXT_PUBLIC_ADMIN_SECRET
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')

    if (!phone) {
      return NextResponse.json({ error: 'Falta el teléfono' }, { status: 400 })
    }

    // Find the customer by phone
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('phone', phone)
      .single()

    if (customer) {
      // 1. Delete all their orders
      await supabaseAdmin.from('orders').delete().eq('customer_id', customer.id)
      // 2. Delete the customer profile
      await supabaseAdmin.from('customers').delete().eq('id', customer.id)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
