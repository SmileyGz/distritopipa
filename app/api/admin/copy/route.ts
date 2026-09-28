import { NextResponse, NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidAdminRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!await isValidAdminRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('copy_drafts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ drafts: data || [] });
}

export async function POST(req: NextRequest) {
  if (!await isValidAdminRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, ...payload } = body;

    if (id) {
      const { data, error } = await supabaseAdmin
        .from('copy_drafts')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (payload.facebook_marketplace_copy) {
        await supabaseAdmin.from('copy_revisions').insert({
          draft_id: id,
          facebook_marketplace_copy: payload.facebook_marketplace_copy
        });
      }

      return NextResponse.json({ draft: data });
    } else {
      const { data, error } = await supabaseAdmin
        .from('copy_drafts')
        .insert([payload])
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (data && payload.facebook_marketplace_copy) {
        await supabaseAdmin.from('copy_revisions').insert({
          draft_id: data.id,
          facebook_marketplace_copy: payload.facebook_marketplace_copy
        });
      }

      return NextResponse.json({ draft: data }, { status: 201 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error procesando solicitud' }, { status: 500 });
  }
}
