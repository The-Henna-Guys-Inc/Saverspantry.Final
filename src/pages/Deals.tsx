import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, Store as StoreIcon, BellRing, Loader2 } from "lucide-react";
import Stores from "./Stores";
import Sales from "./Sales";
import Watchlist from "./Watchlist";
import { useSearchParams } from "react-router-dom";

const Deals = () => {
  const { user, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab = raw === "stores" ? "stores" : raw === "watchlist" ? "watchlist" : "sales";

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const triggerClass = "w-full min-w-0 rounded-xl gap-1 sm:gap-2 px-1.5 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border border-border bg-card text-foreground/70 shadow-soft hover:bg-secondary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-glow transition-smooth";

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <Tag className="h-3.5 w-3.5" /> Deals
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-6">Sales, stores & watchlist</h1>

        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 mb-2 gap-1.5 sm:gap-2 h-auto">
            <TabsTrigger value="sales" className={triggerClass}>
              <Tag className="h-4 w-4" />Sales
            </TabsTrigger>
            <TabsTrigger value="stores" className={triggerClass}>
              <StoreIcon className="h-4 w-4" />Stores
            </TabsTrigger>
            <TabsTrigger value="watchlist" className={triggerClass}>
              <BellRing className="h-4 w-4" />Watchlist
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sales" className="mt-6">
            <Sales embedded />
          </TabsContent>
          <TabsContent value="stores" className="mt-6">
            <Stores embedded />
          </TabsContent>
          <TabsContent value="watchlist" className="mt-6">
            <Watchlist embedded />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

export default Deals;
