import { NextResponse, NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidAdminRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!await isValidAdminRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const daysParam = searchParams.get('days')
    const isAll = daysParam === 'all'
    const days = daysParam && ['7', '30', '90'].includes(daysParam) ? parseInt(daysParam, 10) : 30

    let query = supabaseAdmin
      .from('site_search_logs')
      .select('normalized_query, results_count, created_at')
      .order('created_at', { ascending: false })

    if (!isAll) {
      const since = new Date()
      since.setDate(since.getDate() - days)
      query = query.gte('created_at', since.toISOString())
    }

    const { data, error } = await query.limit(500)

    if (error) {
      console.warn('Site search logs query warning:', error.message)
      return NextResponse.json({ topSearches: [], zeroResultSearches: [] })
    }

    const allRows = data || []
    const counts: Record<string, number> = {}
    const zeroCounts: Record<string, number> = {}

    allRows.forEach((r: any) => {
      const q = (r.normalized_query || '').trim()
      if (!q) return
      counts[q] = (counts[q] || 0) + 1
      if (r.results_count === 0) {
        zeroCounts[q] = (zeroCounts[q] || 0) + 1
      }
    })

    const topSearches = Object.entries(counts)
      .map(([query, count]) => ({ query, count, zero_results: false }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const zeroResultSearches = Object.entries(zeroCounts)
      .map(([query, count]) => ({ query, count, zero_results: true }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return NextResponse.json({ topSearches, zeroResultSearches })
  } catch (error: any) {
    console.error('Search analytics route error:', error?.message || error)
    return NextResponse.json({ topSearches: [], zeroResultSearches: [] })
  }
}
