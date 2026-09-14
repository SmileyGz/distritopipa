import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const daysParam = searchParams.get('days')
    const days = daysParam && ['7', '30', '90'].includes(daysParam) ? parseInt(daysParam, 10) : 30

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    // Run all keyword queries in parallel
    const [topKRes, strikeKRes, allKRes] = await Promise.all([
      // Top keywords by clicks
      supabaseAdmin
        .from('gsc_keyword_metrics')
        .select('query, page, clicks, impressions, ctr, position')
        .gte('date', sinceStr)
        .order('clicks', { ascending: false })
        .limit(50),

      // Striking distance: position 6–20 with meaningful impressions
      supabaseAdmin
        .from('gsc_keyword_metrics')
        .select('query, page, clicks, impressions, ctr, position')
        .gte('date', sinceStr)
        .gte('position', 6)
        .lte('position', 20)
        .gte('impressions', 5)
        .order('impressions', { ascending: false })
        .limit(10),

      // All keywords for long-tail and blog filtering
      supabaseAdmin
        .from('gsc_keyword_metrics')
        .select('query, page, clicks, impressions, ctr, position')
        .gte('date', sinceStr)
        .order('impressions', { ascending: false })
        .limit(200),
    ])

    // Aggregate top keywords by query (sum across pages & days)
    const topKeywords: Record<string, any> = {}
    for (const row of topKRes.data || []) {
      if (!topKeywords[row.query]) {
        topKeywords[row.query] = { query: row.query, page: row.page, clicks: 0, impressions: 0, ctr: 0, position: 0 }
      }
      topKeywords[row.query].clicks += row.clicks
      topKeywords[row.query].impressions += row.impressions
    }
    const topKeywordsList = Object.values(topKeywords)
      .map((k: any) => ({ ...k, ctr: k.impressions > 0 ? k.clicks / k.impressions : 0 }))
      .sort((a: any, b: any) => b.clicks - a.clicks)
      .slice(0, 10)

    const allRows = allKRes.data || []

    // Long-tail: 3+ word queries
    const longTailKeywords = allRows
      .filter((k: any) => k.query.trim().split(/\s+/).length >= 3)
      .slice(0, 10)

    // Blog keywords: pages containing /blog/
    const blogKeywords = allRows
      .filter((k: any) => k.page.includes('/blog/'))
      .slice(0, 10)

    return NextResponse.json({
      topKeywords: topKeywordsList,
      strikingDistance: strikeKRes.data || [],
      longTailKeywords,
      blogKeywords,
    })
  } catch (error: any) {
    console.error('Keywords API error:', error?.message || error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch keyword data' }, { status: 500 })
  }
}
