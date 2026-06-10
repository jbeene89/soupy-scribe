import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
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
import AppEHR from "./pages/AppEHR";
import Unsubscribe from "./pages/Unsubscribe";
import Trust from "./pages/Trust";
import Status from "./pages/Status";
import SubProcessors from "./pages/SubProcessors";
import Security from "./pages/Security";
import AIGovernance from "./pages/AIGovernance";
import MethodologyAuditingTheAuditor from "./pages/MethodologyAuditingTheAuditor";
import MethodologyDenialEconomy from "./pages/MethodologyDenialEconomy";
import AppStrategicTools from "./pages/AppStrategicTools";
import AppOpsCenter from "./pages/AppOpsCenter";
import AppClawbackShield from "./pages/AppClawbackShield";
import AppHCCSweep from "./pages/AppHCCSweep";
import AppPolicyTimeMachine from "./pages/AppPolicyTimeMachine";
import AppPolicyLibrary from "./pages/AppPolicyLibrary";
import AppCompliance from "./pages/AppCompliance";
import AppRecovery from "./pages/AppRecovery";
import AppCapacityBalance from "./pages/AppCapacityBalance";
import AppWriteoffAudit from "./pages/AppWriteoffAudit";
import AppVendorWatch from "./pages/AppVendorWatch";
import AppSmartUpload from "./pages/AppSmartUpload";
import AppLinkedInShare from "./pages/AppLinkedInShare";
import AppOBFetalAudit from "./pages/AppOBFetalAudit";
import CodeBayIntake from "./pages/CodeBayIntake";
import { PHIAcknowledgmentGate } from "@/components/compliance/PHIAcknowledgmentGate";
import { IdleTimeoutGuard } from "@/components/compliance/IdleTimeoutGuard";

const queryClient = new QueryClient();

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <main>
          <Routes>
            {/* Public routes — kept minimal so the app stays gated */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/code-bay-intake" element={<CodeBayIntake />} />

            {/* Everything else now requires sign-in */}
            <Route path="/" element={<RequireAuth><Landing /></RequireAuth>} />
            <Route path="/trust" element={<RequireAuth><Trust /></RequireAuth>} />
            <Route path="/status" element={<RequireAuth><Status /></RequireAuth>} />
            <Route path="/sub-processors" element={<RequireAuth><SubProcessors /></RequireAuth>} />
            <Route path="/security" element={<RequireAuth><Security /></RequireAuth>} />
            <Route path="/ai-governance" element={<RequireAuth><AIGovernance /></RequireAuth>} />
            <Route path="/methodology/auditing-the-auditor" element={<RequireAuth><MethodologyAuditingTheAuditor /></RequireAuth>} />
            <Route path="/methodology/denial-economy" element={<RequireAuth><MethodologyDenialEconomy /></RequireAuth>} />

            {/* Protected admin routes */}
            <Route path="/app" element={
              <AdminProvider>
                <PHIAcknowledgmentGate>
                  <IdleTimeoutGuard />
                  <AdminLayout />
                </PHIAcknowledgmentGate>
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
              <Route path="ehr" element={<AppEHR />} />
              <Route path="strategic-tools" element={<AppStrategicTools />} />
              <Route path="ops-center" element={<AppOpsCenter />} />
              <Route path="clawback-shield" element={<AppClawbackShield />} />
              <Route path="hcc-sweep" element={<AppHCCSweep />} />
              <Route path="policy-time-machine" element={<AppPolicyTimeMachine />} />
              <Route path="policy-library" element={<AppPolicyLibrary />} />
              <Route path="compliance" element={<AppCompliance />} />
              <Route path="recovery" element={<AppRecovery />} />
              <Route path="capacity" element={<AppCapacityBalance />} />
              <Route path="writeoffs" element={<AppWriteoffAudit />} />
              <Route path="vendor-watch" element={<AppVendorWatch />} />
              <Route path="upload" element={<AppSmartUpload />} />
              <Route path="linkedin-share" element={<AppLinkedInShare />} />
              <Route path="ob-fetal-audit" element={<AppOBFetalAudit />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </main>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
