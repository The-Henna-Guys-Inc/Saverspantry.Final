// One-time admin-callable cleanup. Walks the `promo-emails` and `flyer-uploads`
// buckets and deletes legacy files no longer needed under the data-minimization
// policy:
//   - promo-emails: any `raw.json` and any attachment files older than 7 days
//     (current pipeline no longer stores them at all)
//   - flyer-uploads: any source file whose batch row has `stored_file_url='purged'`
//     (defensive — purge already happens inline on confirm; this sweeps leftovers)
//
// Safe to re-run. Returns counts. Admin JWT required.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // Require admin JWT
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return json({ error: "Unauthorized" }, 401);
  const { data: roleRow } = await admin.from("user_roles").select("role")
    .eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return json({ error: "Admin only" }, 403);

  const result = {
    promo_emails_deleted: 0,
    flyer_uploads_deleted: 0,
    errors: [] as string[],
  };

  // --- promo-emails: delete raw.json and attachments older than 7 days ---
  try {
    const cutoff = Date.now() - 7 * 86400_000;
    const folders = await listAllFolders(admin, "promo-emails", "");
    const toDelete: string[] = [];
    for (const folder of folders) {
      const { data: items, error } = await admin.storage.from("promo-emails")
        .list(folder, { limit: 1000 });
      if (error) { result.errors.push(`list ${folder}: ${error.message}`); continue; }
      for (const it of items ?? []) {
        if (!it.name || it.id === null) continue; // skip subfolders (id null)
        const created = it.created_at ? new Date(it.created_at).getTime() : 0;
        const isRawJson = it.name === "raw.json";
        const isOld = created && created < cutoff;
        if (isRawJson || isOld) {
          toDelete.push(folder ? `${folder}/${it.name}` : it.name);
        }
      }
    }
    // Chunked deletes
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      const { error } = await admin.storage.from("promo-emails").remove(chunk);
      if (error) result.errors.push(`remove promo-emails: ${error.message}`);
      else result.promo_emails_deleted += chunk.length;
    }
  } catch (e) {
    result.errors.push(`promo-emails: ${(e as Error).message}`);
  }

  // --- flyer-uploads: delete files whose batch is already marked purged ---
  try {
    const { data: purgedBatches } = await admin
      .from("flyer_extraction_batches")
      .select("source_path")
      .eq("stored_file_url", "purged")
      .not("source_path", "is", null)
      .limit(2000);
    const paths = (purgedBatches ?? []).map((b: any) => b.source_path).filter(Boolean);
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error } = await admin.storage.from("flyer-uploads").remove(chunk);
      if (error) result.errors.push(`remove flyer-uploads: ${error.message}`);
      else result.flyer_uploads_deleted += chunk.length;
    }
  } catch (e) {
    result.errors.push(`flyer-uploads: ${(e as Error).message}`);
  }

  return json({ ok: true, ...result });
});

async function listAllFolders(admin: any, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 3) return [prefix];
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) return [prefix];
  const folders = (data ?? []).filter((x: any) => x.id === null && x.name);
  if (!folders.length) return [prefix];
  const out: string[] = [prefix];
  for (const f of folders) {
    const sub = prefix ? `${prefix}/${f.name}` : f.name;
    out.push(...await listAllFolders(admin, bucket, sub, depth + 1));
  }
  return out;
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
