import { useState, useEffect, useCallback } from 'react';
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
import { LyricProductComparison } from '@/components/LyricProductComparison';
import { LyricAIIntegration } from '@/components/LyricAIIntegration';
import { PresentationMode } from '@/components/PresentationMode';
import { CaseUpload } from '@/components/CaseUpload';
import { AuthGate, SignInDialog } from '@/components/AuthGate';
import { useAuth } from '@/hooks/useAuth';
import { mockCases, mockPatterns, defaultSOUPYConfig } from '@/lib/mockData';
import { fetchCases, fetchCase } from '@/lib/caseService';
import type { AuditCase, AuditPosture, SOUPYConfig } from '@/lib/types';
import { Scale, Brain, GitCompare, BarChart3, Presentation, Layers, Database, HardDrive, Cpu, LogIn, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const [selectedCase, setSelectedCase] = useState<AuditCase | null>(null);
  const [posture, setPosture] = useState<AuditPosture>('payment-integrity');
  const [soupyConfig, setSoupyConfig] = useState<SOUPYConfig>(defaultSOUPYConfig);
  const [activeTab, setActiveTab] = useState('queue');
  const [presentationMode, setPresentationMode] = useState(false);
  
  // Live database cases
  const [liveCases, setLiveCases] = useState<AuditCase[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  const [dataSource, setDataSource] = useState<'mock' | 'live'>('mock');

  const loadLiveCases = useCallback(async () => {
    setLoadingLive(true);
    try {
      const cases = await fetchCases();
      setLiveCases(cases);
    } catch (err) {
      console.error('Failed to load live cases:', err);
    } finally {
      setLoadingLive(false);
    }
  }, []);

  useEffect(() => {
    loadLiveCases();
  }, [loadLiveCases]);

  const allCases = dataSource === 'live' ? liveCases : [...mockCases, ...liveCases];

  const handleSelectCase = async (c: AuditCase) => {
    // If it's a live case, refetch for latest data
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
    setActiveTab('queue');
    loadLiveCases(); // Refresh
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

  if (presentationMode) {
    return <PresentationMode onExit={() => setPresentationMode(false)} />;
  }

  const activeCases = allCases.filter(c => c.status === 'pending' || c.status === 'in-review');
  const historyCases = allCases.filter(c => c.status === 'approved' || c.status === 'rejected');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary">
              <Scale className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Lyric AI</h1>
              <p className="text-xs text-muted-foreground">Medical Code Audit Platform</p>
            </div>
            <div className="flex items-center gap-1.5 ml-4 px-2.5 py-1 rounded-md border bg-accent/10">
              <Brain className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-medium text-accent">SOUPY ThinkTank</span>
            </div>
            {liveCases.length > 0 && (
              <div className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-md border border-consensus/30 bg-consensus/10">
                <Database className="h-3.5 w-3.5 text-consensus" />
                <span className="text-xs font-medium text-consensus">{liveCases.length} Live</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <CaseUpload onCaseCreated={handleCaseCreated} />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-accent/40 text-accent hover:bg-accent/10"
              onClick={() => setPresentationMode(true)}
            >
              <Presentation className="h-3.5 w-3.5" />
              Present
            </Button>
            {/* Data source toggle */}
            <div className="flex items-center border rounded-md overflow-hidden">
              <button
                onClick={() => setDataSource('mock')}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  dataSource === 'mock' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <HardDrive className="h-3 w-3 inline mr-1" />
                Demo
              </button>
              <button
                onClick={() => { setDataSource('live'); loadLiveCases(); }}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  dataSource === 'live' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Database className="h-3 w-3 inline mr-1" />
                Live
              </button>
            </div>
            <AuditPostureToggle posture={posture} onChange={setPosture} />
            <SOUPYConfigDialog config={soupyConfig} onSave={setSoupyConfig} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-8 py-6 space-y-6">
        {/* Claim Accuracy Program value banner */}
        {posture === 'compliance-coaching' && !selectedCase && (
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
                    <p className="text-[10px] text-muted-foreground leading-tight">Projected Appeal Reduction</p>
                  </div>
                  <div className="rounded-md border bg-background p-3 text-center">
                    <p className="text-lg font-semibold text-accent">4.2hrs</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Avg. Time Saved Per Case</p>
                  </div>
                  <div className="rounded-md border bg-background p-3 text-center">
                    <p className="text-lg font-semibold text-foreground">$1.2M</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Est. Annual Admin Savings</p>
                  </div>
                  <div className="rounded-md border bg-background p-3 text-center">
                    <p className="text-lg font-semibold text-info-blue">91%</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Clean Claim Rate Target</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 italic">
                  Providers who receive structured documentation guidance submit claims with sufficient evidence 
                  upfront — eliminating the need for costly post-payment recovery and reducing litigation exposure. 
                  Integrates with Lyric 42 for automated pre-submission validation.
                </p>
              </div>
            </div>
          </div>
        )}
        {selectedCase && activeTab === 'audit' ? (
          <AuditDetail auditCase={selectedCase} onBack={handleBack} posture={posture} onDecisionMade={handleDecisionMade} />
        ) : (
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
              <TabsTrigger value="lyric-map" className="gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Lyric Enhancement
              </TabsTrigger>
              <TabsTrigger value="ai-integration" className="gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                AI Integration
              </TabsTrigger>
              <TabsTrigger value="platform" className="gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Platform Value
              </TabsTrigger>
              <TabsTrigger value="history">Case History</TabsTrigger>
            </TabsList>

            <TabsContent value="queue">
              <CaseQueue
                cases={activeCases}
                onSelectCase={handleSelectCase}
                selectedCaseId={selectedCase?.id}
              />
            </TabsContent>

            <TabsContent value="patterns">
              <PatternAnalysis patterns={mockPatterns} onSelectCase={handleSelectCase} />
            </TabsContent>

            <TabsContent value="comparison">
              <ComparisonView />
            </TabsContent>

            <TabsContent value="lyric-map">
              <LyricProductComparison />
            </TabsContent>

            <TabsContent value="ai-integration">
              <LyricAIIntegration />
            </TabsContent>

            <TabsContent value="platform">
              <div className="space-y-6">
                <PlatformValueCard />
                <IntegrationArchitecture />
              </div>
            </TabsContent>

            <TabsContent value="history">
              <CaseQueue
                cases={historyCases}
                onSelectCase={handleSelectCase}
                selectedCaseId={selectedCase?.id}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default Index;
