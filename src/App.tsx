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
import PantryCalendar from "./pages/PantryCalendar.tsx";
import Settings from "./pages/Settings.tsx";
import Stores from "./pages/Stores.tsx";
import Sales from "./pages/Sales.tsx";
import Watchlist from "./pages/Watchlist.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import BulkBuy from "./pages/BulkBuy.tsx";
import AdminAnalytics from "./pages/AdminAnalytics.tsx";
import AdminSupport from "./pages/AdminSupport.tsx";
import AdminAiUsage from "./pages/AdminAiUsage.tsx";
import AdminAlerts from "./pages/AdminAlerts.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import AdminAudit from "./pages/AdminAudit.tsx";
import AdminSessions from "./pages/AdminSessions.tsx";
import Legal from "./pages/Legal.tsx";
import { InstallPrompt } from "./components/InstallPrompt";
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
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/legal/:type" element={<Legal />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/library" element={<Library />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/pantry" element={<Pantry />} />
          <Route path="/pantry/calendar" element={<PantryCalendar />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/bulk-buy" element={<BulkBuy />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/support" element={<AdminSupport />} />
          <Route path="/admin/ai-usage" element={<AdminAiUsage />} />
          <Route path="/admin/alerts" element={<AdminAlerts />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="/admin/sessions" element={<AdminSessions />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
