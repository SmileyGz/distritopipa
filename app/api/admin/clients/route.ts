import { NextResponse, NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidAdminRequest } from '@/lib/auth'

export async function DELETE(req: NextRequest) {
  if (!await isValidAdminRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('id') || ''
    const rawPhone = searchParams.get('phone') || ''
    const cleanPhone = rawPhone.replace(/\D/g, '')

    let customerIds: string[] = []
    if (clientId) {
      customerIds.push(clientId)
    }

    if (rawPhone || cleanPhone) {
      const { data: customers } = await supabaseAdmin
        .from('customers')
        .select('id')
        .or(`phone.eq.${rawPhone},phone.eq.${cleanPhone}`)

      if (customers) {
        for (const c of customers) {
          if (!customerIds.includes(c.id)) customerIds.push(c.id)
        }
      }
    }

    // If neither id nor phone was provided, wipe orphaned orders without customer_id
    if (customerIds.length === 0 && !rawPhone && !cleanPhone) {
      const { error: orphanErr } = await supabaseAdmin.from('orders').delete().is('customer_id', null)
      if (orphanErr) throw orphanErr
      return NextResponse.json({ success: true })
    }

    // 1. Delete associated points_ledger if table exists
    for (const cid of customerIds) {
      try {
        await supabaseAdmin.from('points_ledger').delete().eq('customer_id', cid)
      } catch {}
    }

    // 2. Delete all orders for this customer (by ID and phone)
    for (const cid of customerIds) {
      await supabaseAdmin.from('orders').delete().eq('customer_id', cid)
    }
    if (rawPhone || cleanPhone) {
      await supabaseAdmin.from('orders').delete().or(`customer_phone.eq.${rawPhone},customer_phone.eq.${cleanPhone}`)
    }

    // 3. Delete customer profiles
    for (const cid of customerIds) {
      const { error: custErr } = await supabaseAdmin.from('customers').delete().eq('id', cid)
      if (custErr) throw custErr
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
