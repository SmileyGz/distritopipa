import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, resultsCount, categoryFilter, sessionId, clickedItemId } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ ok: false, error: 'Query is required and must be a string' }, { status: 400 });
    }

    const normalizedQuery = query.trim().toLowerCase();

    const { error } = await supabase
      .from('site_search_logs')
      .insert([
        {
          query,
          normalized_query: normalizedQuery,
          results_count: resultsCount || 0,
          category_filter: categoryFilter || null,
          session_id: sessionId || null,
          clicked_item_id: clickedItemId || null,
        }
      ]);

    if (error) {
      console.error('Error inserting search log:', error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Search log endpoint error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
