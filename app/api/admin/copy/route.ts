import { NextResponse, NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidAdminRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!await isValidAdminRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('copy_drafts')
    .select('*, copy_revisions(*)')
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
    const { id, copy_revisions, ...payload } = body;

    if (id) {
      const { data: existing } = await supabaseAdmin
        .from('copy_drafts')
        .select('facebook_marketplace_copy')
        .eq('id', id)
        .single();

      let data: any = null;
      let updateError: any = null;

      const res = await supabaseAdmin
        .from('copy_drafts')
        .update(payload)
        .eq('id', id)
        .select('*, copy_revisions(*)')
        .single();

      data = res.data;
      updateError = res.error;

      if (updateError && updateError.message?.includes('publishing_log')) {
        const { publishing_log, ...cleanPayload } = payload;
        const retryRes = await supabaseAdmin
          .from('copy_drafts')
          .update(cleanPayload)
          .eq('id', id)
          .select('*, copy_revisions(*)')
          .single();
        data = retryRes.data;
        updateError = retryRes.error;
      }

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // ONLY record a revision if the text actually changed!
      const newCopy = (payload.facebook_marketplace_copy || '').trim();
      const oldCopy = (existing?.facebook_marketplace_copy || '').trim();
      if (newCopy && newCopy !== oldCopy) {
        await supabaseAdmin.from('copy_revisions').insert({
          draft_id: id,
          facebook_marketplace_copy: newCopy
        });
      }

      return NextResponse.json({ draft: data });
    } else {
      let data: any = null;
      let insertError: any = null;

      const res = await supabaseAdmin
        .from('copy_drafts')
        .insert([payload])
        .select('*, copy_revisions(*)')
        .single();

      data = res.data;
      insertError = res.error;

      if (insertError && insertError.message?.includes('publishing_log')) {
        const { publishing_log, ...cleanPayload } = payload;
        const retryRes = await supabaseAdmin
          .from('copy_drafts')
          .insert([cleanPayload])
          .select('*, copy_revisions(*)')
          .single();
        data = retryRes.data;
        insertError = retryRes.error;
      }

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
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

export async function DELETE(req: NextRequest) {
  if (!await isValidAdminRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const revisionId = searchParams.get('revision_id');
  const clearRevisionsDraftId = searchParams.get('clear_revisions_draft_id');

  // 1. Delete single revision
  if (revisionId) {
    const { error } = await supabaseAdmin
      .from('copy_revisions')
      .delete()
      .eq('id', revisionId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, deletedRevisionId: revisionId });
  }

  // 2. Clear all revisions for a draft
  if (clearRevisionsDraftId) {
    const { error } = await supabaseAdmin
      .from('copy_revisions')
      .delete()
      .eq('draft_id', clearRevisionsDraftId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, clearedDraftId: clearRevisionsDraftId });
  }

  // 3. Delete entire draft
  if (id) {
    const { error } = await supabaseAdmin
      .from('copy_drafts')
      .delete()
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, deletedDraftId: id });
  }

  return NextResponse.json({ error: 'Parámetro requerido' }, { status: 400 });
}
