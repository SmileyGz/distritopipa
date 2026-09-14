import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const POSTHOG_API_BASE = 'https://us.i.posthog.com';

async function executeHogQL(query: string, projectId: string, apiKey: string) {
  const response = await fetch(`${POSTHOG_API_BASE}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query: query
      }
    }),
    cache: 'no-store'
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('PostHog API error:', response.status, errorText);
    throw new Error(`PostHog API returned ${response.status}`);
  }

  const data = await response.json();
  return data.results;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const days = daysParam && ['7', '30', '90'].includes(daysParam) ? parseInt(daysParam, 10) : 7;

    const projectId = process.env.POSTHOG_PROJECT_ID;
    const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;

    if (!projectId || !apiKey) {
      return NextResponse.json({ error: 'PostHog configuration missing' }, { status: 500 });
    }

    const baseWhere = `event = '$pageview' AND timestamp > now() - interval ${days} day`;

    const [
      pageviewsResult,
      visitorsResult,
      topPagesResult,
      referrersResult,
      devicesResult
    ] = await Promise.all([
      executeHogQL(`SELECT count() FROM events WHERE ${baseWhere}`, projectId, apiKey),
      executeHogQL(`SELECT count(DISTINCT distinct_id) FROM events WHERE ${baseWhere}`, projectId, apiKey),
      executeHogQL(`SELECT properties.$current_url, count() as views FROM events WHERE ${baseWhere} GROUP BY properties.$current_url ORDER BY views DESC LIMIT 10`, projectId, apiKey),
      executeHogQL(`SELECT properties.$referrer, count() as views FROM events WHERE ${baseWhere} AND properties.$referrer IS NOT NULL AND properties.$referrer != '' AND properties.$referrer != '$direct' GROUP BY properties.$referrer ORDER BY views DESC LIMIT 10`, projectId, apiKey),
      executeHogQL(`SELECT properties.$device_type, count() as views FROM events WHERE ${baseWhere} GROUP BY properties.$device_type ORDER BY views DESC`, projectId, apiKey)
    ]);

    // Format results
    const totalPageviews = pageviewsResult?.[0]?.[0] || 0;
    const uniqueVisitors = visitorsResult?.[0]?.[0] || 0;
    
    const topPages = (topPagesResult || []).map((row: any[]) => ({
      path: row[0] || '/',
      views: row[1] || 0
    }));

    const topReferrers = (referrersResult || []).map((row: any[]) => {
      const ref = (row[0] || '') as string
      // Extract domain from full URL referrer
      let source = 'Directo'
      try {
        if (ref && ref.startsWith('http')) {
          source = new URL(ref).hostname.replace('www.', '')
        } else if (ref) {
          source = ref
        }
      } catch { source = ref }
      return { source, count: row[1] || 0 }
    });

    const devices = (devicesResult || []).map((row: any[]) => ({
      type: row[0] || 'Unknown',
      count: row[1] || 0
    }));

    return NextResponse.json({
      pageviews: totalPageviews,
      uniqueVisitors,
      topPages,
      topReferrers,
      devices,
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
  }
}
