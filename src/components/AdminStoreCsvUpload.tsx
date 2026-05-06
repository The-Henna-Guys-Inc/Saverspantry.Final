import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FileDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const HEADERS = [
  "name", "chain_name", "cuisine_specialties", "price_tier",
  "description", "address", "city", "region",
];
const TEMPLATE = `${HEADERS.join(",")}
Patel Brothers,Patel Brothers,"indian,middle_eastern",low,"Large Indian grocer with bulk staples",1681 Oak Tree Rd,Edison,NJ
H Mart,H Mart,"korean,japanese,chinese",medium,"Korean-led pan-Asian supermarket",,Edison,NJ
`;

const VALID_TIERS = new Set(["low", "medium", "high", "unknown"]);

type ParsedRow = { rowNumber: number; data: Record<string, string>; error?: string };

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let cur: string[] = []; let field = ""; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
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

function validate(d: Record<string, string>): string | null {
  if (!d.name?.trim()) return "name required";
  if (d.price_tier && !VALID_TIERS.has(d.price_tier.trim().toLowerCase())) return "price_tier must be low/medium/high/unknown";
  return null;
}

function buildPayload(d: Record<string, string>) {
  const cuisines = (d.cuisine_specialties ?? "")
    .split(/[,;|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return {
    name: d.name.trim(),
    chain_name: d.chain_name?.trim() || null,
    cuisine_specialties: cuisines,
    price_tier: (d.price_tier?.trim().toLowerCase() || "unknown"),
    description: d.description?.trim() || null,
    address: d.address?.trim() || null,
    city: d.city?.trim() || null,
    region: d.region?.trim() || null,
    curation_source: "admin_curated",
  };
}

export function AdminStoreCsvUpload({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setRows([]); setFileName(""); if (fileRef.current) fileRef.current.value = ""; };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "curated_stores_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const matrix = parseCsv(text);
    if (matrix.length < 2) { toast.error("CSV is empty or only has a header."); setRows([]); return; }
    const headers = matrix[0].map((h) => h.trim().toLowerCase());
    if (!headers.includes("name")) { toast.error("Missing required column: name"); setRows([]); return; }
    const parsed: ParsedRow[] = matrix.slice(0, 201).slice(1).map((cells, idx) => {
      const data: Record<string, string> = {};
      headers.forEach((h, i) => { data[h] = (cells[i] ?? "").trim(); });
      return { rowNumber: idx + 2, data, error: validate(data) ?? undefined };
    });
    setRows(parsed);
  };

  const valid = rows.filter((r) => !r.error);
  const invalid = rows.filter((r) => r.error);

  const upload = async () => {
    if (!valid.length) return;
    setUploading(true);
    const { error } = await supabase.from("specialty_stores").insert(valid.map((r) => buildPayload(r.data)));
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success(`Published ${valid.length} store${valid.length > 1 ? "s" : ""}.`);
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
          <DialogTitle>Bulk upload curated stores</DialogTitle>
          <DialogDescription>
            Required column: name. Optional: chain_name, cuisine_specialties (comma-separated), price_tier, description, address, city, region.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={downloadTemplate} className="rounded-xl">
              <FileDown className="h-4 w-4 mr-1" /> Download template
            </Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <Button variant="hero" size="sm" className="rounded-xl" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Choose CSV
            </Button>
            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
          </div>

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 text-primary">
                  <CheckCircle2 className="h-4 w-4" /> {valid.length} valid
                </span>
                {invalid.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-4 w-4" /> {invalid.length} skipped
                  </span>
                )}
              </div>
              <div className="max-h-64 overflow-auto rounded-2xl border border-border/50">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">Row</th>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2">City</th>
                      <th className="text-left px-3 py-2">Cuisines</th>
                      <th className="text-left px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.rowNumber} className="border-t border-border/40">
                        <td className="px-3 py-1.5 text-muted-foreground">{r.rowNumber}</td>
                        <td className="px-3 py-1.5 truncate max-w-[180px]">{r.data.name}</td>
                        <td className="px-3 py-1.5 truncate max-w-[120px]">{r.data.city}</td>
                        <td className="px-3 py-1.5 truncate max-w-[200px]">{r.data.cuisine_specialties}</td>
                        <td className={`px-3 py-1.5 ${r.error ? "text-destructive" : "text-primary"}`}>{r.error ?? "OK"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
          <Button variant="hero" onClick={upload} disabled={uploading || !valid.length}>
            {uploading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Publish {valid.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
