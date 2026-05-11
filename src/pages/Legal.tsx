import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Markdown } from "@/components/Markdown";
import { Loader2, ScrollText } from "lucide-react";

type Doc = { title: string; content_md: string; version: number };

const Legal = () => {
  const { type } = useParams();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (type !== "tos" && type !== "privacy") return;
    (async () => {
      const { data } = await supabase.from("legal_documents")
        .select("title, content_md, version")
        .eq("doc_type", type).eq("is_active", true).maybeSingle();
      setDoc(data);
      setLoading(false);
    })();
  }, [type]);

  if (type !== "tos" && type !== "privacy") return <Navigate to="/" replace />;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-3xl mx-auto px-6 py-6 sm:py-10">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <ScrollText className="h-3.5 w-3.5" /> Legal
        </div>
        <div className="flex gap-3 mb-6 text-sm">
          <Link to="/legal/tos" className={`px-3 py-1.5 rounded-full ${type === "tos" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>Terms</Link>
          <Link to="/legal/privacy" className={`px-3 py-1.5 rounded-full ${type === "privacy" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>Privacy</Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !doc ? (
          <Card className="p-8 rounded-3xl text-sm text-muted-foreground">No active document.</Card>
        ) : (
          <Card className="p-6 sm:p-8 rounded-3xl border-border/50 shadow-soft">
            <div className="text-xs text-muted-foreground mb-4">Version {doc.version}</div>
            <Markdown content={doc.content_md} />
          </Card>
        )}
      </div>
    </main>
  );
};

export default Legal;
