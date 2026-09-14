import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// ── JWT-based auth for Google APIs using built-in Node.js crypto ──
function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

async function getAccessToken(): Promise<string> {
  const clientEmail = process.env.GSC_CLIENT_EMAIL
  const privateKeyPem = process.env.GSC_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!clientEmail || !privateKeyPem) {
    throw new Error('Missing GSC_CLIENT_EMAIL or GSC_PRIVATE_KEY')
  }

  const now = Math.floor(Date.now() / 1000)

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  const signatureInput = `${header}.${payload}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(signatureInput)
  const signature = signer.sign(privateKeyPem, 'base64url')

  const jwt = `${signatureInput}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`Token exchange failed: ${err}`)
  }

  const { access_token } = await tokenRes.json()
  return access_token
}

export async function GET(req: Request) {
  try {
    // ── Auth check ──
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const siteUrl = process.env.GSC_SITE_URL
    if (!siteUrl) {
      return NextResponse.json({ error: 'Missing GSC_SITE_URL' }, { status: 500 })
    }

    const accessToken = await getAccessToken()

    // GSC data has a 3-day lag. Support ?days=N for backfill (default: 1 day)
    const url = new URL(req.url)
    const daysBack = Math.min(parseInt(url.searchParams.get('days') || '1', 10), 90)

    const endDate = new Date()
    endDate.setDate(endDate.getDate() - 3) // most recent finalized day
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - (daysBack - 1))

    const startString = startDate.toISOString().split('T')[0]
    const endString = endDate.toISOString().split('T')[0]

    // ── Query Search Console API ──
    const gscRes = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startString,
          endDate: endString,
          dimensions: ['date', 'query', 'page', 'device'],
          rowLimit: 5000,
        }),
      }
    )

    if (!gscRes.ok) {
      const err = await gscRes.text()
      throw new Error(`GSC API error: ${gscRes.status} ${err}`)
    }

    const gscData = await gscRes.json()
    const rows = gscData.rows || []

    if (rows.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No data found' })
    }

    const records = rows.map((row: any) => ({
      date: row.keys?.[0] || endString,
      query: row.keys?.[1] || '',
      page: row.keys?.[2] || '',
      device: row.keys?.[3] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }))

    // ── Upsert into Supabase ──
    const { error } = await supabaseAdmin
      .from('gsc_keyword_metrics')
      .upsert(records, {
        onConflict: 'date, query, page, device',
      })

    if (error) {
      console.error('Error inserting GSC data:', error)
      return NextResponse.json({ error: 'Failed to insert data' }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: records.length })
  } catch (error: any) {
    console.error('GSC sync cron error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
