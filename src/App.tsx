import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AdminProvider } from "@/components/admin/AdminContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AppDashboard from "./pages/AppDashboard";
import AppCases from "./pages/AppCases";
import AppPatterns from "./pages/AppPatterns";
import { AppORReadiness, AppTriageAccuracy, AppPostOpFlow, AppERAcute, AppPatientAdvocate } from "./pages/AppOperational";
import { AppComparison, AppEnhancementMap, AppAIPipeline, AppPlatformValue, AppGhostCases, AppEducation } from "./pages/AppPlatform";
import AppHistory from "./pages/AppHistory";
import AppInbox from "./pages/AppInbox";
import AppSystemImpact from "./pages/AppSystemImpact";
import AppImaging from "./pages/AppImaging";
import AppRevenueIntegrity from "./pages/AppRevenueIntegrity";
import Unsubscribe from "./pages/Unsubscribe";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />

            {/* Protected admin routes */}
            <Route path="/app" element={
              <AdminProvider>
                <AdminLayout />
              </AdminProvider>
            }>
              <Route index element={<AppDashboard />} />
              <Route path="cases" element={<AppCases />} />
              <Route path="patterns" element={<AppPatterns />} />
              <Route path="comparison" element={<AppComparison />} />
              <Route path="enhancements" element={<AppEnhancementMap />} />
              <Route path="ai-pipeline" element={<AppAIPipeline />} />
              <Route path="platform" element={<AppPlatformValue />} />
              <Route path="ghost-cases" element={<AppGhostCases />} />
              <Route path="or-readiness" element={<AppORReadiness />} />
              <Route path="triage" element={<AppTriageAccuracy />} />
              <Route path="postop" element={<AppPostOpFlow />} />
              <Route path="er-acute" element={<AppERAcute />} />
              <Route path="advocate" element={<AppPatientAdvocate />} />
              <Route path="education" element={<AppEducation />} />
              <Route path="history" element={<AppHistory />} />
              <Route path="inbox" element={<AppInbox />} />
              <Route path="system-impact" element={<AppSystemImpact />} />
              <Route path="imaging" element={<AppImaging />} />
              <Route path="revenue-integrity" element={<AppRevenueIntegrity />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
