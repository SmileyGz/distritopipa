// app/api/generate-caption/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/generate-caption
// Calls Claude API to generate a branded Instagram/Facebook caption
// in Distrito Pipa's voice: dark, editorial, direct, Spanish-primary.
// Legal disclaimer always appended. Never claims product effects.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAdmin(req: NextRequest) {
  return req.headers.get('x-admin-secret') === (process.env.ADMIN_SECRET || process.env.NEXT_PUBLIC_ADMIN_SECRET)
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    post_type,
    platform,
    product_name,
    product_price,
    campaign_theme,
    extra_context,
  } = body

  // Get brand config from Supabase
  const { data: config } = await supabaseAdmin
    .from('brand_config')
    .select('key, value')

  const cfg: Record<string, string> = {}
  config?.forEach((r: { key: string; value: string }) => { cfg[r.key] = r.value })

  const disclaimer     = cfg['legal_disclaimer']     || 'Accesorios de uso personal · Producto legal · No incluye sustancias'
  const brandHashtags  = cfg['brand_hashtags']       || '#DistritoPipa #Cancún'
  const whatsappCta    = cfg['whatsapp_cta']         || '📲 Pide el tuyo → distritopipa.com'
  const ageDisclaimer  = cfg['age_disclaimer']       || '+18 · Solo adultos'

  // Platform-specific constraints
  const platformNotes: Record<string, string> = {
    instagram_feed:  'Feed post. Max 2,200 chars. Use line breaks for readability. 3–5 relevant emojis.',
    instagram_story: 'Story caption. Max 60 chars — very short, punchy, one idea.',
    instagram_reel:  'Reel caption. Hook in first line (no truncation). Conversational. Max 150 chars visible.',
    facebook:        'Facebook post. Can be slightly longer. Direct, community-feel. Max 300 chars.',
    facebook_story:  'Story. Ultra-short. Max 50 chars.',
  }

  // Post type guidance
  const typeGuidance: Record<string, string> = {
    product:    'Focus on the product — name, size, price. Make it desirable. No claims about effects.',
    lifestyle:  'Vibe and culture. No product required. Dark, editorial, Cancún nightlife energy.',
    promo:      'Urgency without pressure. Bundle deal or limited offer. Price front and center.',
    story:      'One single message. Question or statement. Drives interaction (poll, reply).',
    reel:       'Hook first — something that stops the scroll. Fast, punchy, brand energy.',
    community:  'Engage the audience. Ask a question, share a tip, or celebrate a customer.',
  }

  const systemPrompt = `You are the social media voice of Distrito Pipa, a premium smoke shop accessories brand in Cancún, Mexico.

BRAND VOICE:
- Dark, editorial, confident. Think high-end streetwear meets Cancún night energy.
- Spanish primary. You may use 1–2 English words for style but write in Spanish.
- Direct and real. No corporate language, no excessive exclamation marks.
- Never preachy, never apologetic about the product category.
- Short sentences. Strong nouns and verbs. Minimal adjectives.

ABSOLUTE RULES — these cannot be broken:
1. NEVER describe or imply what the product does to the user's body or mind.
2. NEVER show or describe product use.
3. NEVER target or address minors.
4. The legal disclaimer "${disclaimer}" MUST appear at the end of every caption, on its own line.
5. "${ageDisclaimer}" must appear somewhere in the caption.
6. Do not promise delivery times or make claims you cannot keep.
7. No vape products, no e-cigarettes, no nicotine products — never mention them.

OUTPUT FORMAT:
Return ONLY the caption text, ready to copy-paste. No explanation, no preamble, no markdown.
End with these two lines exactly:
—
${disclaimer}
${ageDisclaimer}`

  const userPrompt = `Write a ${platform} caption for a ${post_type} post.

${product_name ? `Product: ${product_name}${product_price ? ` · $${product_price} MXN` : ''}` : ''}
${campaign_theme ? `Campaign theme: ${campaign_theme}` : ''}
${extra_context ? `Additional context: ${extra_context}` : ''}

Platform requirements: ${platformNotes[platform] || 'Standard social post.'}
Post type guidance: ${typeGuidance[post_type] || ''}

After the main caption, add on separate lines:
${whatsappCta}
${brandHashtags}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('Claude API error:', err)
      return NextResponse.json({ error: 'Caption generation failed' }, { status: 500 })
    }

    const data = await response.json()
    const caption = data.content?.[0]?.text?.trim() || ''

    return NextResponse.json({ caption, ai_generated: true })
  } catch (err) {
    console.error('Caption API error:', err)
    return NextResponse.json({ error: 'Caption generation failed' }, { status: 500 })
  }
}
