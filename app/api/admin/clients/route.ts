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

export async function PATCH(req: NextRequest) {
  if (!await isValidAdminRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { clientId, oldPhone, field, value } = body

    if (!oldPhone && !clientId) {
      return NextResponse.json({ error: 'Identificador de cliente requerido (teléfono o id)' }, { status: 400 })
    }

    const rawOldPhone = String(oldPhone || '').trim()
    const cleanOldPhone = rawOldPhone.replace(/\D/g, '')

    // Locate target customer by ID or phone in customers table
    let targetCustomerId = clientId || ''
    if (!targetCustomerId && (rawOldPhone || cleanOldPhone)) {
      const { data: custs } = await supabaseAdmin
        .from('customers')
        .select('id, phone')
        .or(`phone.eq.${rawOldPhone},phone.eq.${cleanOldPhone}`)
        .limit(1)

      if (custs && custs.length > 0) {
        targetCustomerId = custs[0].id
      }
    }

    if (field === 'phone') {
      const rawNewPhone = String(value || '').trim()
      const cleanNewPhone = rawNewPhone.replace(/\D/g, '')

      if (!cleanNewPhone) {
        return NextResponse.json({ error: 'El nuevo número telefónico no puede estar vacío' }, { status: 400 })
      }

      // Check if another customer already exists with this new phone number
      const { data: existingNewCust } = await supabaseAdmin
        .from('customers')
        .select('id, phone')
        .or(`phone.eq.${cleanNewPhone},phone.eq.${rawNewPhone}`)
        .maybeSingle()

      let finalCustomerId = targetCustomerId

      if (existingNewCust && existingNewCust.id !== targetCustomerId) {
        // Merge into the existing customer with this new phone
        finalCustomerId = existingNewCust.id

        if (targetCustomerId) {
          // Reassign orders to the existing customer
          await supabaseAdmin
            .from('orders')
            .update({ customer_id: finalCustomerId, customer_phone: cleanNewPhone })
            .eq('customer_id', targetCustomerId)

          // Delete the old customer to prevent unique constraint conflict
          await supabaseAdmin.from('customers').delete().eq('id', targetCustomerId)
        }
      } else if (targetCustomerId) {
        // Update the customer record
        const { error: updErr } = await supabaseAdmin
          .from('customers')
          .update({ phone: cleanNewPhone })
          .eq('id', targetCustomerId)

        if (updErr) throw updErr
      } else {
        // Create new customer profile if none existed
        const { data: createdCust, error: insErr } = await supabaseAdmin
          .from('customers')
          .insert({ phone: cleanNewPhone })
          .select('id')
          .single()

        if (!insErr && createdCust) {
          finalCustomerId = createdCust.id
        }
      }

      // Update all orders linked to this customer
      if (finalCustomerId) {
        await supabaseAdmin
          .from('orders')
          .update({ customer_phone: cleanNewPhone, customer_id: finalCustomerId })
          .eq('customer_id', finalCustomerId)
      }

      // Also update orders that had the old phone string
      if (rawOldPhone || cleanOldPhone) {
        await supabaseAdmin
          .from('orders')
          .update({
            customer_phone: cleanNewPhone,
            ...(finalCustomerId ? { customer_id: finalCustomerId } : {}),
          })
          .or(`customer_phone.eq.${rawOldPhone},customer_phone.eq.${cleanOldPhone}`)
      }

      // Update community posts if any had the old phone
      if (rawOldPhone || cleanOldPhone) {
        try {
          await supabaseAdmin
            .from('community_posts')
            .update({ customer_id: cleanNewPhone })
            .or(`customer_id.eq.${rawOldPhone},customer_id.eq.${cleanOldPhone}`)
        } catch {}
      }

      return NextResponse.json({ success: true, newPhone: cleanNewPhone, customerId: finalCustomerId })
    }

    if (field === 'name') {
      const newName = String(value || '').trim()
      if (targetCustomerId) {
        await supabaseAdmin.from('customers').update({ first_name: newName }).eq('id', targetCustomerId)
      }
      try {
        if (targetCustomerId) {
          await supabaseAdmin.from('orders').update({ customer_name: newName }).eq('customer_id', targetCustomerId)
        }
        if (rawOldPhone || cleanOldPhone) {
          await supabaseAdmin.from('orders').update({ customer_name: newName }).or(`customer_phone.eq.${rawOldPhone},customer_phone.eq.${cleanOldPhone}`)
        }
      } catch {}
      return NextResponse.json({ success: true, name: newName })
    }

    if (field === 'email') {
      const newEmail = String(value || '').trim()
      if (targetCustomerId) {
        await supabaseAdmin.from('customers').update({ email: newEmail || null }).eq('id', targetCustomerId)
      }
      try {
        if (targetCustomerId) {
          await supabaseAdmin.from('orders').update({ customer_email: newEmail || null }).eq('customer_id', targetCustomerId)
        }
        if (rawOldPhone || cleanOldPhone) {
          await supabaseAdmin.from('orders').update({ customer_email: newEmail || null }).or(`customer_phone.eq.${rawOldPhone},customer_phone.eq.${cleanOldPhone}`)
        }
      } catch {}
      return NextResponse.json({ success: true, email: newEmail })
    }

    if (field === 'address') {
      const newAddress = String(value || '').trim()
      try {
        if (targetCustomerId) {
          await supabaseAdmin.from('orders').update({ delivery_address: newAddress }).eq('customer_id', targetCustomerId)
        }
        if (rawOldPhone || cleanOldPhone) {
          await supabaseAdmin.from('orders').update({ delivery_address: newAddress }).or(`customer_phone.eq.${rawOldPhone},customer_phone.eq.${cleanOldPhone}`)
        }
      } catch {}
      return NextResponse.json({ success: true, address: newAddress })
    }

    if (field === 'notes') {
      const newNotes = String(value || '').trim()
      try {
        if (targetCustomerId) {
          await supabaseAdmin.from('orders').update({ admin_notes: newNotes }).eq('customer_id', targetCustomerId)
        }
        if (rawOldPhone || cleanOldPhone) {
          await supabaseAdmin.from('orders').update({ admin_notes: newNotes }).or(`customer_phone.eq.${rawOldPhone},customer_phone.eq.${cleanOldPhone}`)
        }
      } catch {}
      return NextResponse.json({ success: true, notes: newNotes })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error updating client in admin:', err)
    return NextResponse.json({ error: err.message || 'Error al actualizar cliente' }, { status: 500 })
  }
}
