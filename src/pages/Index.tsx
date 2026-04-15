import { useState, useEffect, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CaseQueue } from '@/components/CaseQueue';
import { AuditDetail } from '@/components/AuditDetail';
import { PatternAnalysis } from '@/components/PatternAnalysis';
import { AuditPostureToggle } from '@/components/AuditPostureToggle';
import { SOUPYConfigDialog } from '@/components/SOUPYConfigDialog';
import { ComparisonView } from '@/components/ComparisonView';
import { PlatformValueCard } from '@/components/PlatformValueCard';
import { IntegrationArchitecture } from '@/components/IntegrationArchitecture';
import { PlatformEnhancementMap } from '@/components/PlatformEnhancementMap';
import { AIPipelineIntegration } from '@/components/AIPipelineIntegration';
import { PresentationMode } from '@/components/PresentationMode';
import { CaseUpload } from '@/components/CaseUpload';
import { AuthGate, SignInDialog } from '@/components/AuthGate';
import { useAuth } from '@/hooks/useAuth';
import { mockCases, mockPatterns, defaultSOUPYConfig } from '@/lib/mockData';
import { deleteCase, deriveLivePatterns, type LivePhysicianPattern } from '@/lib/soupyEngineService';
import { fetchCases, fetchCase } from '@/lib/caseService';
import type { AuditCase, AuditPosture, SOUPYConfig } from '@/lib/types';
import type { AppMode } from '@/lib/providerTypes';
import { Scale, Brain, GitCompare, BarChart3, Presentation, Layers, Database, HardDrive, Cpu, LogIn, LogOut, GraduationCap, Stethoscope, FileDown, Ghost, ShieldAlert, Target, Bed } from 'lucide-react';
import { exportPlatformSummaryPDF } from '@/lib/exportPlatformSummary';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

// Provider components
import { AppModeToggle } from '@/components/provider/AppModeToggle';
import { ProviderDashboard } from '@/components/provider/ProviderDashboard';
import { ProviderCaseDetail } from '@/components/provider/ProviderCaseDetail';
import { EducationInsights } from '@/components/provider/EducationInsights';
import { ProviderCaseUpload } from '@/components/provider/ProviderCaseUpload';
import { GhostCaseManager } from '@/components/GhostCaseManager';
import { ModeSelectionGate } from '@/components/ModeSelectionGate';

// Operational modules
import { ORReadinessModule } from '@/components/operational/ORReadinessModule';
import { TriageAccuracyModule } from '@/components/operational/TriageAccuracyModule';
import { PostOpFlowModule } from '@/components/operational/PostOpFlowModule';
import { mockORReadinessEvents, mockTriageEvents, mockPostOpFlowEvents } from '@/lib/operationalMockData';
import { fetchORReadinessEvents, fetchTriageAccuracyEvents, fetchPostOpFlowEvents } from '@/lib/operationalService';
import type { ORReadinessEvent, TriageAccuracyEvent, PostOpFlowEvent } from '@/lib/operationalTypes';

const Index = () => {
  const { isAuthenticated } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [selectedCase, setSelectedCase] = useState<AuditCase | null>(null);
  const [soupyConfig, setSoupyConfig] = useState<SOUPYConfig>(defaultSOUPYConfig);
  const [activeTab, setActiveTab] = useState('queue');
  const [presentationMode, setPresentationMode] = useState(false);

  // Mode gate: check sessionStorage for previously selected mode
  const [modeSelected, setModeSelected] = useState<boolean>(() => !!sessionStorage.getItem('soupy_app_mode'));
  const [appMode, setAppMode] = useState<AppMode>(() => (sessionStorage.getItem('soupy_app_mode') as AppMode) || 'payer');
  const posture: AuditPosture = appMode === 'provider' ? 'compliance-coaching' : 'payment-integrity';
  
  // Live database cases
  const [liveCases, setLiveCases] = useState<AuditCase[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  const [dataSource, setDataSource] = useState<'mock' | 'live'>('mock');
  const [livePatterns, setLivePatterns] = useState<LivePhysicianPattern[]>([]);

  // Live operational events
  const [liveOREvents, setLiveOREvents] = useState<ORReadinessEvent[]>([]);
  const [liveTriageEvents, setLiveTriageEvents] = useState<TriageAccuracyEvent[]>([]);
  const [livePostOpEvents, setLivePostOpEvents] = useState<PostOpFlowEvent[]>([]);

  const loadLiveCases = useCallback(async () => {
    setLoadingLive(true);
    try {
      const cases = await fetchCases();
      setLiveCases(cases);
      setLivePatterns(deriveLivePatterns(cases));
    } catch (err) {
      console.error('Failed to load live cases:', err);
    } finally {
      setLoadingLive(false);
    }
  }, []);

  const loadLiveOperationalEvents = useCallback(async () => {
    try {
      const [or, triage, postop] = await Promise.all([
        fetchORReadinessEvents(),
        fetchTriageAccuracyEvents(),
        fetchPostOpFlowEvents(),
      ]);
      setLiveOREvents(or);
      setLiveTriageEvents(triage);
      setLivePostOpEvents(postop);
    } catch (err) {
      console.error('Failed to load operational events:', err);
    }
  }, []);

  useEffect(() => {
    loadLiveCases();
    loadLiveOperationalEvents();

    // Realtime subscription — refresh case list on any change
    const channel = supabase
      .channel('audit-cases-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'audit_cases' },
        () => { loadLiveCases(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'processing_queue' },
        () => { loadLiveCases(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'or_readiness_events' },
        () => { loadLiveOperationalEvents(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'triage_accuracy_events' },
        () => { loadLiveOperationalEvents(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'postop_flow_events' },
        () => { loadLiveOperationalEvents(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadLiveCases, loadLiveOperationalEvents]);

  const allCases = dataSource === 'live' ? liveCases : [...mockCases, ...liveCases];

  // Operational events: demo shows mock + live, live shows only live
  const orEvents = dataSource === 'live' ? liveOREvents : [...mockORReadinessEvents, ...liveOREvents];
  const triageEvents = dataSource === 'live' ? liveTriageEvents : [...mockTriageEvents, ...liveTriageEvents];
  const postOpEvents = dataSource === 'live' ? livePostOpEvents : [...mockPostOpFlowEvents, ...livePostOpEvents];

  const handleDeleteCase = async (caseId: string) => {
    try {
      await deleteCase(caseId);
      toast.success('Case deleted');
      if (selectedCase?.id === caseId) {
        setSelectedCase(null);
        setActiveTab(appMode === 'provider' ? 'provider-dashboard' : 'queue');
      }
      loadLiveCases();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete case');
    }
  };

  const handleSelectCase = async (c: AuditCase) => {
    if (liveCases.some(lc => lc.id === c.id)) {
      const fresh = await fetchCase(c.id);
      if (fresh) {
        setSelectedCase(fresh);
        setActiveTab('audit');
        return;
      }
    }
    setSelectedCase(c);
    setActiveTab('audit');
  };

  const handleBack = () => {
    setSelectedCase(null);
    setActiveTab(appMode === 'provider' ? 'provider-dashboard' : 'queue');
    loadLiveCases();
  };

  const handleDecisionMade = (outcome: 'approved' | 'rejected' | 'info-requested') => {
    if (!selectedCase) return;
    const currentCases = allCases.filter(c => c.status === 'pending' || c.status === 'in-review');
    const currentIndex = currentCases.findIndex(c => c.id === selectedCase.id);
    const nextCase = currentCases[currentIndex + 1] || currentCases[currentIndex - 1];
    if (nextCase) {
      handleSelectCase(nextCase);
    } else {
      handleBack();
      toast.info('No more cases in queue');
    }
  };

  const handleCaseCreated = async (caseId: string) => {
    await loadLiveCases();
    const newCase = await fetchCase(caseId);
    if (newCase) {
      setSelectedCase(newCase);
      setActiveTab('audit');
    }
  };

  const handleModeChange = (mode: AppMode) => {
    sessionStorage.setItem('soupy_app_mode', mode);
    setAppMode(mode);
    setModeSelected(true);
    setSelectedCase(null);
    setActiveTab(mode === 'provider' ? 'provider-dashboard' : 'queue');
  };

  // Show mode selection gate if no mode has been chosen this session
  if (!modeSelected) {
    return <ModeSelectionGate onSelect={handleModeChange} />;
  }

  if (presentationMode) {
    return <PresentationMode onExit={() => setPresentationMode(false)} />;
  }

  const activeCases = allCases.filter(c => c.status === 'pending' || c.status === 'in-review');
  const historyCases = allCases.filter(c => c.status === 'approved' || c.status === 'rejected');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur-md shadow-sm">
        {/* Top bar — brand + auth */}
        <div className="container mx-auto px-8">
          <div className="flex items-center justify-between h-14">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-primary/90">
                <Scale className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-base font-semibold tracking-tight text-foreground">SOUPY</h1>
                <span className="hidden sm:inline text-[11px] text-muted-foreground font-medium tracking-wide uppercase">
                  {appMode === 'provider' ? 'Provider Readiness' : 'Payment Integrity'}
                </span>
              </div>
            </div>

            {/* Right — status pills + auth */}
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded border bg-accent/5 text-accent">
                <Brain className="h-3 w-3" />
                <span className="text-[10px] font-semibold tracking-wide uppercase">SOUPY</span>
              </div>
              {appMode === 'provider' && (
                <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded border border-info-blue/20 bg-info-blue/5 text-info-blue">
                  <Stethoscope className="h-3 w-3" />
                  <span className="text-[10px] font-semibold tracking-wide uppercase">Provider</span>
                </div>
              )}
              {liveCases.length > 0 && (
                <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded border border-consensus/20 bg-consensus/5 text-consensus">
                  <Database className="h-3 w-3" />
                  <span className="text-[10px] font-semibold">{liveCases.length} Live</span>
                </div>
              )}
              <div className="w-px h-5 bg-border mx-1 hidden md:block" />
              {isAuthenticated ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => supabase.auth.signOut()}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setShowSignIn(true)}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </Button>
              )}
            </div>
          </div>

          {/* Bottom toolbar — actions */}
          <div className="flex items-center gap-1.5 pb-2 -mt-1 overflow-x-auto scrollbar-none">
            <AppModeToggle mode={appMode} onChange={handleModeChange} />
            <div className="w-px h-4 bg-border mx-0.5" />
            {appMode === 'payer' && (
              <CaseUpload onCaseCreated={handleCaseCreated} />
            )}
            {appMode === 'provider' && (
              <ProviderCaseUpload onCaseCreated={handleCaseCreated} />
            )}
            {appMode === 'payer' && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground hover:text-accent"
                onClick={() => setPresentationMode(true)}
              >
                <Presentation className="h-3.5 w-3.5" />
                Present
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => { exportPlatformSummaryPDF(); toast.success('PDF downloaded'); }}
            >
              <FileDown className="h-3.5 w-3.5" />
              Export
            </Button>
            <div className="w-px h-4 bg-border mx-0.5" />
            {/* Data source toggle */}
            <div className="flex items-center rounded-md border overflow-hidden">
              <button
                onClick={() => setDataSource('mock')}
                className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                  dataSource === 'mock' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <HardDrive className="h-3 w-3 inline mr-1" />
                Demo
              </button>
              <button
                onClick={() => { setDataSource('live'); loadLiveCases(); }}
                className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                  dataSource === 'live' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Database className="h-3 w-3 inline mr-1" />
                Live
              </button>
            </div>
            {appMode === 'payer' && (
              <>
                <div className="w-px h-4 bg-border mx-0.5" />
                <SOUPYConfigDialog config={soupyConfig} onSave={setSoupyConfig} />
              </>
            )}
          </div>
        </div>
      </header>

      <SignInDialog open={showSignIn} onOpenChange={setShowSignIn} />

      {/* Main Content */}
      <main className="container mx-auto px-8 py-6 space-y-6">
        {/* Payer mode: Claim Accuracy Program value banner */}
        {appMode === 'payer' && posture === 'compliance-coaching' && !selectedCase && (
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-consensus/10 shrink-0">
                <Scale className="h-5 w-5 text-consensus" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold mb-1">Claim Accuracy Program — Payer Value Proposition</h2>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  Proactive documentation guidance reduces downstream audit friction. When providers submit 
                  complete, evidence-backed claims, the result is fewer flags, fewer appeals, and dramatically 
                  reduced administrative burden — saving payer resources at every stage of the payment integrity lifecycle.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-md border bg-background p-3 text-center">
                    <p className="text-lg font-semibold text-consensus">68%</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Projected Appeal Reduction*</p>
                  </div>
                  <div className="rounded-md border bg-background p-3 text-center">
                    <p className="text-lg font-semibold text-accent">4.2hrs</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Est. Time Saved Per Case*</p>
                  </div>
                  <div className="rounded-md border bg-background p-3 text-center">
                    <p className="text-lg font-semibold text-foreground">$1.2M</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Est. Annual Admin Savings*</p>
                  </div>
                  <div className="rounded-md border bg-background p-3 text-center">
                    <p className="text-lg font-semibold text-info-blue">91%</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Clean Claim Rate Target*</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 italic">
                   * All figures are modeled estimates based on platform architecture. Providers who receive structured 
                   documentation guidance submit claims with sufficient evidence upfront — eliminating the need for 
                   costly post-payment recovery and reducing litigation exposure.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Case Detail Views */}
        {selectedCase && activeTab === 'audit' ? (
          appMode === 'provider' ? (
            <ProviderCaseDetail auditCase={selectedCase} onBack={handleBack} />
          ) : (
            <AuditDetail auditCase={selectedCase} onBack={handleBack} posture={posture} onDecisionMade={handleDecisionMade} />
          )
        ) : appMode === 'provider' ? (
          /* ═══════════════ PROVIDER MODE TABS ═══════════════ */
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="provider-dashboard" className="gap-1.5">
                <Stethoscope className="h-3.5 w-3.5" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="provider-cases">
                Case Reviews
                {allCases.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{allCases.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="provider-education" className="gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" />
                Education Insights
              </TabsTrigger>
              <TabsTrigger value="provider-or-readiness" className="gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                OR Readiness
              </TabsTrigger>
              <TabsTrigger value="provider-triage" className="gap-1.5">
                <Target className="h-3.5 w-3.5" />
                Triage Accuracy
              </TabsTrigger>
              <TabsTrigger value="provider-postop" className="gap-1.5">
                <Bed className="h-3.5 w-3.5" />
                Post-Op Flow
              </TabsTrigger>
            </TabsList>

            <TabsContent value="provider-dashboard">
              <ProviderDashboard dataSource={dataSource} />
            </TabsContent>

            <TabsContent value="provider-cases">
              <CaseQueue
                cases={allCases}
                onSelectCase={handleSelectCase}
                selectedCaseId={selectedCase?.id}
                onDeleteCase={handleDeleteCase}
              />
            </TabsContent>

            <TabsContent value="provider-education">
              <EducationInsights dataSource={dataSource} />
            </TabsContent>

            <TabsContent value="provider-or-readiness">
              <ORReadinessModule events={orEvents} posture="compliance-coaching" />
            </TabsContent>

            <TabsContent value="provider-triage">
              <TriageAccuracyModule events={triageEvents} posture="compliance-coaching" />
            </TabsContent>

            <TabsContent value="provider-postop">
              <PostOpFlowModule events={postOpEvents} posture="compliance-coaching" />
            </TabsContent>
          </Tabs>
        ) : (
          /* ═══════════════ PAYER MODE TABS ═══════════════ */
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="queue">
                Case Queue
                {activeCases.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{activeCases.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="patterns">Pattern Analysis</TabsTrigger>
              <TabsTrigger value="comparison" className="gap-1.5">
                <GitCompare className="h-3.5 w-3.5" />
                Value Demo
              </TabsTrigger>
              <TabsTrigger value="enhancement-map" className="gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Enhancement Map
              </TabsTrigger>
              <TabsTrigger value="ai-integration" className="gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                AI Pipeline
              </TabsTrigger>
              <TabsTrigger value="platform" className="gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Platform Value
              </TabsTrigger>
              <TabsTrigger value="ghost-cases" className="gap-1.5">
                <Ghost className="h-3.5 w-3.5" />
                Ghost Cases
              </TabsTrigger>
              <TabsTrigger value="or-readiness" className="gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                OR Readiness
              </TabsTrigger>
              <TabsTrigger value="triage-accuracy" className="gap-1.5">
                <Target className="h-3.5 w-3.5" />
                Triage Accuracy
              </TabsTrigger>
              <TabsTrigger value="postop-flow" className="gap-1.5">
                <Bed className="h-3.5 w-3.5" />
                Post-Op Flow
              </TabsTrigger>
              <TabsTrigger value="history">Case History</TabsTrigger>
            </TabsList>

            <TabsContent value="queue">
              <CaseQueue
                cases={activeCases}
                onSelectCase={handleSelectCase}
                selectedCaseId={selectedCase?.id}
                onDeleteCase={handleDeleteCase}
              />
            </TabsContent>

            <TabsContent value="patterns">
              <PatternAnalysis
                patterns={dataSource === 'live' && livePatterns.length > 0
                  ? livePatterns.map((lp, idx) => ({
                      patternId: `LIVE-${idx}`,
                      physicianId: lp.physicianId,
                      physicianName: lp.physicianName,
                      cptCodes: lp.cptCodes,
                      cases: lp.cases,
                      totalCases: lp.totalCases,
                      rejectionRate: lp.rejectionRate,
                      totalClaimAmount: lp.avgClaimAmount * lp.totalCases,
                      averageClaimAmount: lp.avgClaimAmount,
                      dateRange: { start: '', end: '' },
                      insights: [`Avg risk score: ${lp.avgRiskScore}`, `${lp.totalCases} case(s) analyzed`],
                    }))
                  : mockPatterns
                }
                onSelectCase={handleSelectCase}
              />
            </TabsContent>

            <TabsContent value="comparison">
              <ComparisonView />
            </TabsContent>

            <TabsContent value="enhancement-map">
              <PlatformEnhancementMap />
            </TabsContent>

            <TabsContent value="ai-integration">
              <AIPipelineIntegration />
            </TabsContent>

            <TabsContent value="platform">
              <div className="space-y-6">
                <PlatformValueCard />
                <IntegrationArchitecture />
              </div>
            </TabsContent>

            <TabsContent value="ghost-cases">
              <GhostCaseManager />
            </TabsContent>

            <TabsContent value="or-readiness">
              <ORReadinessModule events={orEvents} posture={posture} />
            </TabsContent>

            <TabsContent value="triage-accuracy">
              <TriageAccuracyModule events={triageEvents} posture={posture} />
            </TabsContent>

            <TabsContent value="postop-flow">
              <PostOpFlowModule events={postOpEvents} posture={posture} />
            </TabsContent>

            <TabsContent value="history">
              <CaseQueue
                cases={historyCases}
                onSelectCase={handleSelectCase}
                selectedCaseId={selectedCase?.id}
                onDeleteCase={handleDeleteCase}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default Index;
