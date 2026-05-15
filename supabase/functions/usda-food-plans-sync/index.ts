// USDA Food Plans monthly sync.
// Pulls the latest "Official USDA Food Plans: Cost of Food Monthly Report" PDF
// from USDA FNS, extracts cost data via Gemini, upserts into usda_food_plans,
// logs the run, and emails admins on success / error.
//
// Triggered by a monthly cron job, or manually via POST { override_url?: string }.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { Resend } from 'npm:resend@4.0.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const PLAN_KEYS = ['thrifty', 'low_cost', 'moderate_cost', 'liberal'] as const;

// USDA FNS publishes monthly under fns.usda.gov/sites/default/files/resource-files/
// Current pattern (2025+): cnpp-costfood-{tfp|3levels|ak-hi}-{month}{year}.pdf
// "tfp" = Thrifty Food Plan; "3levels" = Low-Cost / Moderate-Cost / Liberal.
function candidateUrls(date: Date): string[] {
  const months = ['january','february','march','april','may','june',
                  'july','august','september','october','november','december'];
  const abbr = ['jan','feb','mar','apr','may','jun','jul','aug','sept','oct','nov','dec'];
  const m = months[date.getMonth()];
  const a = abbr[date.getMonth()];
  const y = date.getFullYear();
  const base = 'https://www.fns.usda.gov/sites/default/files/resource-files';
  // 3levels first (covers 3 of 4 plans), then tfp. Try long + abbreviated month names.
  return [
    `${base}/cnpp-costfood-3levels-${m}${y}.pdf`,
    `${base}/cnpp-costfood-3levels-${a}${y}.pdf`,
    `${base}/cnpp-costfood-tfp-${m}${y}.pdf`,
    `${base}/cnpp-costfood-tfp-${a}${y}.pdf`,
  ];
}

const UA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'application/pdf,application/octet-stream,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.fns.usda.gov/research/cnpp/usda-food-plans/cost-food-monthly-reports',
};

// Infer report month from filename like "...march2026.pdf" / "...mar2026.pdf"
function inferMonthFromUrl(url: string): Date {
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const abbr = ['jan','feb','mar','apr','may','jun','jul','aug','sep','sept','oct','nov','dec'];
  const lower = url.toLowerCase();
  const yMatch = lower.match(/(20\d{2})/);
  const year = yMatch ? parseInt(yMatch[1]) : new Date().getFullYear();
  for (let i = 0; i < months.length; i++) {
    if (lower.includes(months[i])) return new Date(year, i, 1);
  }
  for (let i = 0; i < abbr.length; i++) {
    if (lower.includes(abbr[i])) {
      const idx = abbr[i] === 'sept' ? 8 : (abbr[i] === 'sep' ? 8 : i);
      return new Date(year, Math.min(idx, 11), 1);
    }
  }
  return new Date();
}

async function findLatestPdf(override?: string): Promise<{ url: string; bytes: Uint8Array; reportMonth: Date } | null> {
  if (override) {
    const r = await fetch(override, { headers: UA_HEADERS });
    if (!r.ok) return null;
    return { url: override, bytes: new Uint8Array(await r.arrayBuffer()), reportMonth: inferMonthFromUrl(override) };
  }
  // Try current month, walk back up to 3 months
  const now = new Date();
  for (let back = 0; back < 4; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    for (const url of candidateUrls(d)) {
      try {
        const r = await fetch(url, { headers: UA_HEADERS });
        if (r.ok && r.headers.get('content-type')?.includes('pdf')) {
          return { url, bytes: new Uint8Array(await r.arrayBuffer()), reportMonth: d };
        }
      } catch (_) { /* try next */ }
    }
  }
  return null;
}

async function extractWithGemini(pdfBytes: Uint8Array, sourceUrl: string) {
  const b64 = btoa(String.fromCharCode(...pdfBytes));
  const sysPrompt = `Extract the USDA monthly food cost table from this PDF.
Return rows for every household composition shown (individuals by age/sex, and families).
For each row, give: household_type (verbatim label), age_min, age_max, sex (male|female|null),
weekly_cost_usd, monthly_cost_usd, plan (thrifty|low_cost|moderate_cost|liberal).
Also return the report_month as YYYY-MM-DD (first of month).`;

  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: sysPrompt },
          { type: 'file', file: { filename: 'usda.pdf', file_data: `data:application/pdf;base64,${b64}` } },
        ],
      }],
      tools: [{
        type: 'function',
        function: {
          name: 'submit_food_plans',
          parameters: {
            type: 'object',
            properties: {
              report_month: { type: 'string' },
              rows: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    household_type: { type: 'string' },
                    age_min: { type: ['integer','null'] },
                    age_max: { type: ['integer','null'] },
                    sex: { type: ['string','null'], enum: ['male','female',null] },
                    weekly_cost_usd: { type: ['number','null'] },
                    monthly_cost_usd: { type: 'number' },
                    plan: { type: 'string', enum: PLAN_KEYS as unknown as string[] },
                  },
                  required: ['household_type','monthly_cost_usd','plan'],
                },
              },
            },
            required: ['report_month','rows'],
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'submit_food_plans' } },
    }),
  });
  if (!res.ok) throw new Error(`Gemini extract failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error('No tool_call returned from Gemini');
  return JSON.parse(args) as { report_month: string; rows: any[] };
}

async function notifyAdmins(supabase: any, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
  if (!roles?.length) return;
  const emails: string[] = [];
  for (const { user_id } of roles) {
    const { data } = await supabase.auth.admin.getUserById(user_id);
    if (data?.user?.email) emails.push(data.user.email);
  }
  if (!emails.length) return;
  const resend = new Resend(RESEND_API_KEY);
  await resend.emails.send({
    from: 'Saver\'s Pantry <noreply@saverspantry.com>',
    to: emails,
    subject,
    html,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let override: string | undefined;
  let triggered_by = 'cron';
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      override = body.override_url;
      triggered_by = body.triggered_by || 'manual';
    }
  } catch (_) {}

  const log = async (row: any) =>
    supabase.from('usda_sync_log').insert({ ...row, triggered_by });

  try {
    const found = await findLatestPdf(override);
    if (!found) {
      await log({ status: 'error', error_message: 'No USDA PDF found in last 4 months' });
      await notifyAdmins(supabase, 'USDA sync: no file found',
        '<p>The monthly USDA sync could not locate a PDF for the last 4 months. The URL pattern may have changed — paste a manual <code>override_url</code> via the admin trigger.</p>');
      return new Response(JSON.stringify({ ok: false, reason: 'no_pdf' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Skip if we already have this month
    const { data: existing } = await supabase
      .from('usda_food_plans')
      .select('id')
      .eq('report_month', found.reportMonth.toISOString().slice(0, 10))
      .limit(1);
    if (existing?.length && !override) {
      await log({ status: 'no_change', report_month: found.reportMonth.toISOString().slice(0, 10), source_url: found.url });
      return new Response(JSON.stringify({ ok: true, status: 'no_change' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const extracted = await extractWithGemini(found.bytes, found.url);
    const reportMonth = extracted.report_month || found.reportMonth.toISOString().slice(0, 10);
    const rows = extracted.rows.map((r) => ({
      report_month: reportMonth,
      plan: r.plan,
      household_type: r.household_type,
      age_min: r.age_min ?? null,
      age_max: r.age_max ?? null,
      sex: r.sex ?? null,
      weekly_cost_usd: r.weekly_cost_usd ?? null,
      monthly_cost_usd: r.monthly_cost_usd,
      source_url: found.url,
    }));

    const { error: upErr } = await supabase
      .from('usda_food_plans')
      .upsert(rows, { onConflict: 'report_month,plan,household_type' });
    if (upErr) throw upErr;

    await log({ status: 'success', report_month: reportMonth, rows_imported: rows.length, source_url: found.url });
    await notifyAdmins(supabase, `USDA sync: ${reportMonth} imported (${rows.length} rows)`,
      `<p>New USDA Food Plans data imported for <strong>${reportMonth}</strong>.</p>
       <p>${rows.length} rows across ${PLAN_KEYS.length} plan tiers.</p>
       <p>Source: <a href="${found.url}">${found.url}</a></p>`);

    return new Response(JSON.stringify({ ok: true, report_month: reportMonth, rows: rows.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    await log({ status: 'error', error_message: String(e?.message ?? e) });
    await notifyAdmins(supabase, 'USDA sync FAILED',
      `<p>The monthly USDA sync errored:</p><pre>${String(e?.message ?? e)}</pre>`);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
