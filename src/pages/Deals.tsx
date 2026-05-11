import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, Store as StoreIcon, Loader2 } from "lucide-react";
import Stores from "./Stores";
import Sales from "./Sales";
import { useSearchParams } from "react-router-dom";

const Deals = () => {
  const { user, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "sales" ? "sales" : "stores";

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <Tag className="h-3.5 w-3.5" /> Deals
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-6">Stores & sales</h1>

        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-transparent p-0 mb-2 gap-1.5 sm:gap-2 h-auto">
            <TabsTrigger
              value="stores"
              className="rounded-xl gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border border-border bg-card text-foreground/70 shadow-soft hover:bg-secondary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-glow transition-smooth"
            >
              <StoreIcon className="h-4 w-4" />Stores
            </TabsTrigger>
            <TabsTrigger
              value="sales"
              className="rounded-xl gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border border-border bg-card text-foreground/70 shadow-soft hover:bg-secondary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-glow transition-smooth"
            >
              <Tag className="h-4 w-4" />Sales
            </TabsTrigger>
          </TabsList>
          <TabsContent value="stores" className="mt-6">
            <Stores embedded />
          </TabsContent>
          <TabsContent value="sales" className="mt-6">
            <Sales embedded />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

export default Deals;
