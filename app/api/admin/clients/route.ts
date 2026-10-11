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

    // If neither id nor phone was provided, do not perform any deletion
    if (customerIds.length === 0 && !rawPhone && !cleanPhone) {
      return NextResponse.json({ error: 'Se requiere ID o teléfono para eliminar un cliente' }, { status: 400 })
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

export async function GET(req: NextRequest) {
  if (!await isValidAdminRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const query = (searchParams.get('query') || searchParams.get('q') || searchParams.get('email') || '').trim()

    let custQuery = supabaseAdmin.from('customers').select('*')
    if (query) {
      custQuery = custQuery.or(`first_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
    }
    const { data: customers, error: custErr } = await custQuery.order('created_at', { ascending: false })
    if (custErr) throw custErr

    const { data: rawOrders, error: ordErr } = await supabaseAdmin
      .from('orders')
      .select('*, customers (id, first_name, phone, email)')
      .order('created_at', { ascending: false })

    if (ordErr) throw ordErr

    const mappedOrders = (rawOrders || []).map((o: any) => {
      const custPhone = o.customers?.phone || o.customer_phone || ''
      const custName = o.customers?.first_name || o.customer_name || (o.customer_email ? o.customer_email.split('@')[0] : 'Cliente')
      const custEmail = o.customer_email || o.customers?.email || ''

      return {
        id: o.id,
        order_number: o.order_number || o.id.split('-')[0].toUpperCase(),
        status: o.status === 'new' ? 'pending' : o.status,
        customer_id: o.customer_id || o.customers?.id,
        customer_name: custName,
        customer_phone: custPhone,
        customer_email: custEmail,
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
        customer_notes: o.delivery_notes || o.customer_notes || '',
        delivery_notes: o.delivery_notes || o.customer_notes || '',
        admin_notes: o.admin_notes || '',
        created_at: o.created_at,
        updated_at: o.updated_at,
      }
    })

    return NextResponse.json({
      customers: customers || [],
      orders: mappedOrders,
    })
  } catch (err: any) {
    console.error('Error in GET /api/admin/clients:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!await isValidAdminRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { clientId, oldPhone, field, value, action } = body

    // Support dedicated merge action
    if (action === 'merge' || field === 'merge') {
      const targetPhone = body.targetPhone || oldPhone || ''
      const sourceEmail = String(body.sourceEmail || value || '').trim().toLowerCase()
      const newName = body.newName || ''
      const cleanTargetPhone = String(targetPhone).replace(/\D/g, '')

      let targetCust: any = null
      if (clientId) {
        const { data } = await supabaseAdmin.from('customers').select('*').eq('id', clientId).maybeSingle()
        targetCust = data
      }
      if (!targetCust && cleanTargetPhone) {
        const { data } = await supabaseAdmin.from('customers').select('*').or(`phone.eq.${cleanTargetPhone},phone.eq.${targetPhone}`).maybeSingle()
        targetCust = data
      }

      if (!targetCust) {
        return NextResponse.json({ error: 'Cliente destino no encontrado' }, { status: 404 })
      }

      const { data: sourceCusts } = await supabaseAdmin
        .from('customers')
        .select('*')
        .or(`email.ilike.%${sourceEmail}%,email.ilike.%chulim%`)
        .limit(10)

      const sourceCust = (sourceCusts || []).find((c: any) => c.id !== targetCust.id)

      if (sourceCust) {
        await supabaseAdmin
          .from('orders')
          .update({
            customer_id: targetCust.id,
            customer_phone: targetCust.phone,
            customer_email: sourceCust.email || sourceEmail
          })
          .eq('customer_id', sourceCust.id)

        await supabaseAdmin.from('customers').delete().eq('id', sourceCust.id)
      }

      const updates: any = { email: sourceCust?.email || sourceEmail }
      if (newName) updates.first_name = newName
      await supabaseAdmin.from('customers').update(updates).eq('id', targetCust.id)

      await supabaseAdmin
        .from('orders')
        .update({ customer_email: updates.email })
        .eq('customer_id', targetCust.id)

      return NextResponse.json({
        success: true,
        message: 'Cliente fusionado exitosamente',
        mergedCustomer: { ...targetCust, ...updates },
        mergedFrom: sourceCust || null
      })
    }

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
      const newEmail = String(value || '').trim().toLowerCase()
      let finalCustomerId = targetCustomerId

      if (newEmail) {
        // Check if another customer already has this email
        const { data: existingEmailCust } = await supabaseAdmin
          .from('customers')
          .select('id, phone, first_name, email')
          .eq('email', newEmail)
          .maybeSingle()

        if (existingEmailCust && existingEmailCust.id !== targetCustomerId) {
          // Merge: reassign orders and delete duplicate
          if (targetCustomerId) {
            await supabaseAdmin
              .from('orders')
              .update({ customer_id: targetCustomerId, customer_email: newEmail })
              .eq('customer_id', existingEmailCust.id)

            await supabaseAdmin.from('customers').delete().eq('id', existingEmailCust.id)

            await supabaseAdmin.from('customers').update({ email: newEmail }).eq('id', targetCustomerId)
          } else {
            finalCustomerId = existingEmailCust.id
          }
        } else if (targetCustomerId) {
          await supabaseAdmin.from('customers').update({ email: newEmail }).eq('id', targetCustomerId)
        }
      } else if (targetCustomerId) {
        await supabaseAdmin.from('customers').update({ email: null }).eq('id', targetCustomerId)
      }

      try {
        if (finalCustomerId) {
          await supabaseAdmin.from('orders').update({ customer_email: newEmail || null }).eq('customer_id', finalCustomerId)
        }
        if (rawOldPhone || cleanOldPhone) {
          await supabaseAdmin.from('orders').update({ customer_email: newEmail || null }).or(`customer_phone.eq.${rawOldPhone},customer_phone.eq.${cleanOldPhone}`)
        }
      } catch {}
      return NextResponse.json({ success: true, email: newEmail, customerId: finalCustomerId })
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
