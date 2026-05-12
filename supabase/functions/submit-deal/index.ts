import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'https://esm.sh/zod@3.23.8';

const BodySchema = z.object({
  food_name: z.string().trim().min(2).max(80),
  title: z.string().trim().min(3).max(140),
  store_name: z.string().trim().min(2).max(120),
  store_chain: z.string().trim().max(80).optional().nullable(),
  store_id: z.string().uuid().optional().nullable(),
  sale_price_usd: z.number().positive().max(10000),
  regular_price_usd: z.number().positive().max(10000).optional().nullable(),
  pack_size: z.string().trim().max(60).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  region: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  ends_in_days: z.number().int().min(1).max(60),
  category: z.string().trim().max(40).optional().nullable(),
  photo_url: z.string().url().max(500).optional().nullable(),
});

const DAILY_LIMIT = 5;
const MIN_ACCOUNT_AGE_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    // Account age check
    const createdAt = new Date(user.created_at).getTime();
    const ageHours = (Date.now() - createdAt) / 3_600_000;
    if (ageHours < MIN_ACCOUNT_AGE_HOURS) {
      return json({ error: `Your account must be at least 24 hours old to submit deals. Try again in ${Math.ceil(MIN_ACCOUNT_AGE_HOURS - ageHours)}h.` }, 403);
    }

    // Rate limit: 5 per rolling 24h
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await supabase
      .from('user_deal_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('submitted_at', since);
    if ((count ?? 0) >= DAILY_LIMIT) {
      return json({ error: `Daily limit reached (${DAILY_LIMIT} submissions per 24h). Try again later.` }, 429);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, 400);
    }
    const b = parsed.data;

    // Soft-flag check: 3 rejections in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { count: rejected } = await supabase
      .from('sale_observations')
      .select('id', { count: 'exact', head: true })
      .eq('submitted_by_user_id', user.id)
      .eq('moderation_status', 'rejected')
      .gte('created_at', thirtyDaysAgo);

    const moderation_status = (rejected ?? 0) >= 3 ? 'pending_review' : 'auto_approved';

    const savings_pct = b.regular_price_usd && b.regular_price_usd > b.sale_price_usd
      ? Math.round(((b.regular_price_usd - b.sale_price_usd) / b.regular_price_usd) * 100)
      : null;

    const ends_at = new Date(Date.now() + b.ends_in_days * 86_400_000).toISOString();

    const { data: inserted, error: insErr } = await supabase
      .from('sale_observations')
      .insert({
        food_name: b.food_name,
        title: b.title,
        store_name: b.store_name,
        store_chain: b.store_chain ?? null,
        store_id: b.store_id ?? null,
        sale_price_usd: b.sale_price_usd,
        regular_price_usd: b.regular_price_usd ?? null,
        savings_pct,
        pack_size: b.pack_size ?? null,
        city: b.city ?? null,
        region: b.region ?? null,
        address: b.address ?? null,
        category: b.category ?? null,
        photo_url: b.photo_url ?? null,
        ends_at,
        source: 'user_submitted',
        submitted_by_user_id: user.id,
        moderation_status,
      })
      .select('id')
      .single();
    if (insErr) return json({ error: insErr.message }, 400);

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const ua = req.headers.get('user-agent') || null;
    await supabase.from('user_deal_submissions').insert({
      user_id: user.id,
      deal_observation_id: inserted.id,
      ip_address: ip,
      user_agent: ua,
    });

    return json({ ok: true, id: inserted.id, moderation_status });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
