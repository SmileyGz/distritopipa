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
    const phone = searchParams.get('phone') || ''

    // If there is no phone number, it means these are orphaned test orders (no customer profile)
    // We should safely wipe any order that has no customer_id.
    if (!phone) {
      const { error: orphanErr } = await supabaseAdmin.from('orders').delete().is('customer_id', null)
      if (orphanErr) throw orphanErr
      return NextResponse.json({ success: true })
    }

    // Find the customer by phone (use limit instead of single to prevent crashes if zero or multiple exist)
    const { data: customers, error: fetchErr } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('phone', phone)
      .limit(1)

    if (fetchErr) throw fetchErr

    if (customers && customers.length > 0) {
      const customer = customers[0]
      // 1. Delete all their orders
      const { error: orderErr } = await supabaseAdmin.from('orders').delete().eq('customer_id', customer.id)
      if (orderErr) throw orderErr
      
      // 2. Delete the customer profile
      const { error: custErr } = await supabaseAdmin.from('customers').delete().eq('id', customer.id)
      if (custErr) throw custErr
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
