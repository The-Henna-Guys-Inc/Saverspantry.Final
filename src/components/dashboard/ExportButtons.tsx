import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const ExportButtons = () => {
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (path: string, fallbackName: string, key: string) => {
    setBusy(key);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in first");
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("content-disposition")?.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackName;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message ?? "Could not export");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" className="rounded-xl"
        disabled={busy !== null}
        onClick={() => download("export-analytics?type=savings", "savings.csv", "s")}>
        {busy === "s" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />}
        Savings CSV
      </Button>
      <Button variant="outline" size="sm" className="rounded-xl"
        disabled={busy !== null}
        onClick={() => download("export-analytics?type=pantry", "pantry.csv", "p")}>
        {busy === "p" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />}
        Pantry CSV
      </Button>
      <Button variant="outline" size="sm" className="rounded-xl"
        disabled={busy !== null}
        onClick={() => download("export-analytics?type=spend", "spend.csv", "sp")}>
        {busy === "sp" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />}
        Spend CSV
      </Button>
      <Button variant="hero" size="sm" className="rounded-xl"
        disabled={busy !== null}
        onClick={() => download("monthly-recap-pdf", "recap.pdf", "pdf")}>
        {busy === "pdf" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
        Monthly recap PDF
      </Button>
    </div>
  );
};
