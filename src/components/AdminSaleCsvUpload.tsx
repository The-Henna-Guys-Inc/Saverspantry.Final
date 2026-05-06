import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FileDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const TEMPLATE_HEADERS = [
  "food_name", "title", "store_name", "store_chain",
  "sale_price_usd", "regular_price_usd", "pack_size",
  "address", "city", "region", "google_maps_url", "ends_in_days",
];

const TEMPLATE_CSV = `${TEMPLATE_HEADERS.join(",")}
basmati rice,Royal basmati 20 lb — $5 off,Patel Brothers,,19.99,24.99,20 lb bag,1681 Oak Tree Rd,Edison,NJ,https://maps.google.com/?q=Patel+Brothers+Edison+NJ,10
chicken thighs,Boneless skinless thighs — $2/lb off,Costco,Costco,2.99,4.99,per lb,,,,,7
`;

type ParsedRow = {
  rowNumber: number;
  data: Record<string, string>;
  error?: string;
};

// Simple, dependency-free CSV parser that handles quoted fields & escaped quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); rows.push(cur); cur = []; field = "";
      } else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

function validateRow(data: Record<string, string>): string | null {
  if (!data.food_name?.trim()) return "food_name required";
  if (!data.title?.trim()) return "title required";
  if (!data.store_name?.trim()) return "store_name required";
  const sale = parseFloat(data.sale_price_usd);
  if (!isFinite(sale) || sale <= 0) return "sale_price_usd must be > 0";
  if (data.regular_price_usd && !isFinite(parseFloat(data.regular_price_usd))) return "regular_price_usd invalid";
  if (data.ends_in_days && !isFinite(parseInt(data.ends_in_days, 10))) return "ends_in_days invalid";
  return null;
}

function buildInsertPayload(data: Record<string, string>, userId: string) {
  const sale = parseFloat(data.sale_price_usd);
  const reg = data.regular_price_usd ? parseFloat(data.regular_price_usd) : null;
  const savings_pct = reg && reg > sale ? Math.round(((reg - sale) / reg) * 100) : null;
  const days = data.ends_in_days ? parseInt(data.ends_in_days, 10) : 7;
  return {
    food_name: data.food_name.trim(),
    title: data.title.trim(),
    store_name: data.store_name.trim(),
    store_chain: data.store_chain?.trim() || null,
    sale_price_usd: sale,
    regular_price_usd: reg,
    savings_pct,
    pack_size: data.pack_size?.trim() || null,
    city: data.city?.trim() || null,
    region: data.region?.trim() || null,
    ends_at: new Date(Date.now() + days * 86400000).toISOString(),
    source: "admin_curated",
    moderation_status: "approved",
    submitted_by_user_id: userId,
  };
}

export function AdminSaleCsvUpload({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setRows([]); setFileName(""); if (fileRef.current) fileRef.current.value = ""; };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "curated_sales_template.csv";
    a.click(); URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const matrix = parseCsv(text);
    if (matrix.length < 2) { toast.error("CSV is empty or only has a header."); setRows([]); return; }
    const headers = matrix[0].map((h) => h.trim().toLowerCase());
    const missing = ["food_name", "title", "store_name", "sale_price_usd"].filter((h) => !headers.includes(h));
    if (missing.length) { toast.error(`Missing required column(s): ${missing.join(", ")}`); setRows([]); return; }

    const parsed: ParsedRow[] = matrix.slice(0, 201).slice(1).map((cells, idx) => {
      const data: Record<string, string> = {};
      headers.forEach((h, i) => { data[h] = (cells[i] ?? "").trim(); });
      return { rowNumber: idx + 2, data, error: validateRow(data) ?? undefined };
    });
    setRows(parsed);
  };

  const validRows = rows.filter((r) => !r.error);
  const invalidRows = rows.filter((r) => r.error);

  const upload = async () => {
    if (!validRows.length) return;
    setUploading(true);
    const payload = validRows.map((r) => buildInsertPayload(r.data, userId));
    const { error } = await supabase.from("sale_observations").insert(payload);
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Published ${payload.length} sale${payload.length > 1 ? "s" : ""}.`);
    setOpen(false); reset(); onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl">
          <Upload className="h-4 w-4 mr-1" /> Bulk CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk upload curated sales</DialogTitle>
          <DialogDescription>
            Upload a CSV to publish many sales at once. Required columns: food_name, title, store_name, sale_price_usd.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={downloadTemplate} className="rounded-xl">
              <FileDown className="h-4 w-4 mr-1" /> Download template
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Button variant="hero" size="sm" className="rounded-xl" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Choose CSV
            </Button>
            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
          </div>

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 text-primary">
                  <CheckCircle2 className="h-4 w-4" /> {validRows.length} valid
                </span>
                {invalidRows.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-4 w-4" /> {invalidRows.length} skipped
                  </span>
                )}
              </div>

              <div className="max-h-64 overflow-auto rounded-2xl border border-border/50">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">Row</th>
                      <th className="text-left px-3 py-2">Title</th>
                      <th className="text-left px-3 py-2">Store</th>
                      <th className="text-right px-3 py-2">Price</th>
                      <th className="text-left px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.rowNumber} className="border-t border-border/40">
                        <td className="px-3 py-1.5 text-muted-foreground">{r.rowNumber}</td>
                        <td className="px-3 py-1.5 truncate max-w-[200px]">{r.data.title}</td>
                        <td className="px-3 py-1.5 truncate max-w-[120px]">{r.data.store_name}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{r.data.sale_price_usd}</td>
                        <td className={`px-3 py-1.5 ${r.error ? "text-destructive" : "text-primary"}`}>
                          {r.error ?? "OK"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length === 200 && (
                <p className="text-[10px] text-muted-foreground">Showing first 200 rows; trim your file if larger.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
          <Button variant="hero" onClick={upload} disabled={uploading || !validRows.length}>
            {uploading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Publish {validRows.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
