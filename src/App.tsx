import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import Library from "./pages/Library.tsx";
import Planner from "./pages/Planner.tsx";
import Pantry from "./pages/Pantry.tsx";
import Settings from "./pages/Settings.tsx";
import Deals from "./pages/Deals.tsx";
import Watchlist from "./pages/Watchlist.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import BulkBuy from "./pages/BulkBuy.tsx";
import Swap from "./pages/Swap.tsx";
import Welcome from "./pages/Welcome.tsx";
import Demo from "./pages/Demo.tsx";
import AdminAnalytics from "./pages/AdminAnalytics.tsx";
import AdminSupport from "./pages/AdminSupport.tsx";
import AdminAiUsage from "./pages/AdminAiUsage.tsx";
import AdminAlerts from "./pages/AdminAlerts.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import AdminAudit from "./pages/AdminAudit.tsx";
import AdminSessions from "./pages/AdminSessions.tsx";
import AdminDeals from "./pages/AdminDeals.tsx";
import AdminEmailInbox from "./pages/AdminEmailInbox.tsx";
import AdminEmailAliases from "./pages/AdminEmailAliases.tsx";
import AdminUsdaSync from "./pages/AdminUsdaSync.tsx";
import AdminFlyerSources from "./pages/AdminFlyerSources.tsx";
import Legal from "./pages/Legal.tsx";
import Privacy from "./pages/Privacy.tsx";
import Terms from "./pages/Terms.tsx";
import Support from "./pages/Support.tsx";
import JoinHousehold from "./pages/JoinHousehold.tsx";
import { InstallPrompt } from "./components/InstallPrompt";
import { MobileTabBar } from "./components/MobileTabBar";
import { LegalAcceptanceGate } from "./components/LegalAcceptanceGate";
import { SessionEnforcer } from "./components/SessionEnforcer";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <InstallPrompt />
      <BrowserRouter>
        <LegalAcceptanceGate />
        <SessionEnforcer />
        <div className="pb-mobile-nav">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/legal/:type" element={<Legal />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/support" element={<Support />} />
          <Route path="/join/:code" element={<JoinHousehold />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/library" element={<Library />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/pantry" element={<Pantry />} />
          <Route path="/pantry/calendar" element={<Navigate to="/pantry?tab=expiry" replace />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/stores" element={<Navigate to="/deals?tab=stores" replace />} />
          <Route path="/sales" element={<Navigate to="/deals?tab=sales" replace />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/bulk-buy" element={<Navigate to="/pantry?tab=bulk-buy" replace />} />
          <Route path="/swap" element={<Swap />} />
          <Route path="/cook" element={<Navigate to="/swap" replace />} />
          <Route path="/cook/recipes" element={<Navigate to="/planner?tab=recipes" replace />} />
          <Route path="/cook/nutrition" element={<Navigate to="/" replace />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/support" element={<AdminSupport />} />
          <Route path="/admin/ai-usage" element={<AdminAiUsage />} />
          <Route path="/admin/alerts" element={<AdminAlerts />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="/admin/sessions" element={<AdminSessions />} />
          <Route path="/admin/deals" element={<AdminDeals />} />
          <Route path="/admin/email-inbox" element={<AdminEmailInbox />} />
          <Route path="/admin/email-aliases" element={<AdminEmailAliases />} />
          <Route path="/admin/usda-sync" element={<AdminUsdaSync />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </div>
        <MobileTabBar />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
