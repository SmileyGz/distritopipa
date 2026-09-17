import { NextResponse } from 'next/server';
import { isValidAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const POSTHOG_API_BASE = 'https://us.i.posthog.com';

async function executeHogQL(query: string, projectId: string, apiKey: string) {
  const response = await fetch(`${POSTHOG_API_BASE}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    cache: 'no-store'
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('PostHog API error:', response.status, errorText);
    throw new Error(`PostHog API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.results;
}

export async function GET(request: Request) {
  if (!await isValidAdminRequest(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const days = daysParam && ['7', '30', '90'].includes(daysParam) ? parseInt(daysParam, 10) : 7;

    const projectId = process.env.POSTHOG_PROJECT_ID;
    const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;

    if (!projectId || !apiKey) {
      return NextResponse.json({ error: 'PostHog configuration missing' }, { status: 500 });
    }

    // Customer-only pageviews: exclude admin, Vercel preview URLs, and localhost
    const baseWhere = [
      `event = '$pageview'`,
      `timestamp > now() - interval ${days} day`,
      `properties.$current_url NOT LIKE '%vercel.app%'`,
      `properties.$current_url NOT LIKE '%localhost%'`,
      `properties.$current_url NOT LIKE '%/admin%'`,
    ].join(' AND ');

    const [
      pageviewsResult,
      visitorsResult,
      topPagesResult,
      referrersResult,
      devicesResult
    ] = await Promise.all([
      executeHogQL(
        `SELECT count() FROM events WHERE ${baseWhere}`,
        projectId, apiKey
      ),
      executeHogQL(
        `SELECT count(DISTINCT distinct_id) FROM events WHERE ${baseWhere}`,
        projectId, apiKey
      ),
      executeHogQL(
        `SELECT properties.$current_url, count() as views FROM events WHERE ${baseWhere} GROUP BY properties.$current_url ORDER BY views DESC LIMIT 10`,
        projectId, apiKey
      ),
      executeHogQL(
        `SELECT properties.$referrer, count() as views FROM events WHERE ${baseWhere} AND properties.$referrer IS NOT NULL AND properties.$referrer != '' AND properties.$referrer NOT LIKE '%vercel.app%' AND properties.$referrer NOT LIKE '%distritopipa.com%' GROUP BY properties.$referrer ORDER BY views DESC LIMIT 10`,
        projectId, apiKey
      ),
      executeHogQL(
        `SELECT properties.$device_type, count() as views FROM events WHERE ${baseWhere} GROUP BY properties.$device_type ORDER BY views DESC`,
        projectId, apiKey
      )
    ]);

    const totalPageviews = pageviewsResult?.[0]?.[0] || 0;
    const uniqueVisitors = visitorsResult?.[0]?.[0] || 0;

    const topPages = (topPagesResult || []).map((row: any[]) => {
      const fullUrl = (row[0] || '/') as string;
      let path = fullUrl;
      try { path = new URL(fullUrl).pathname; } catch { /* already a path */ }
      return { path, views: row[1] || 0 };
    });

    const topReferrers = (referrersResult || []).map((row: any[]) => {
      const ref = (row[0] || '') as string;
      let source = 'Directo';
      try {
        if (ref && ref.startsWith('http')) {
          source = new URL(ref).hostname.replace('www.', '');
        } else if (ref) {
          source = ref;
        }
      } catch { source = ref; }
      return { source, count: row[1] || 0 };
    });

    const devices = (devicesResult || []).map((row: any[]) => ({
      type: row[0] || 'Unknown',
      count: row[1] || 0
    }));

    return NextResponse.json({ pageviews: totalPageviews, uniqueVisitors, topPages, topReferrers, devices });

  } catch (error: any) {
    console.error('Visitor analytics error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch analytics data' }, { status: 500 });
  }
}
