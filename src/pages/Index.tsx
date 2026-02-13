import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CaseQueue } from '@/components/CaseQueue';
import { AuditDetail } from '@/components/AuditDetail';
import { PatternAnalysis } from '@/components/PatternAnalysis';
import { AuditPostureToggle } from '@/components/AuditPostureToggle';
import { SOUPYConfigDialog } from '@/components/SOUPYConfigDialog';
import { ComparisonView } from '@/components/ComparisonView';
import { mockCases, mockPatterns, defaultSOUPYConfig } from '@/lib/mockData';
import type { AuditCase, AuditPosture, SOUPYConfig } from '@/lib/types';
import { Scale, Brain, GitCompare } from 'lucide-react';

const Index = () => {
  const [selectedCase, setSelectedCase] = useState<AuditCase | null>(null);
  const [posture, setPosture] = useState<AuditPosture>('payment-integrity');
  const [soupyConfig, setSoupyConfig] = useState<SOUPYConfig>(defaultSOUPYConfig);
  const [activeTab, setActiveTab] = useState('queue');

  const handleSelectCase = (c: AuditCase) => {
    setSelectedCase(c);
    setActiveTab('audit');
  };

  const handleBack = () => {
    setSelectedCase(null);
    setActiveTab('queue');
  };

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
          </div>
          <div className="flex items-center gap-3">
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
          <AuditDetail auditCase={selectedCase} onBack={handleBack} posture={posture} />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="queue">Case Queue</TabsTrigger>
              <TabsTrigger value="patterns">Pattern Analysis</TabsTrigger>
              <TabsTrigger value="comparison" className="gap-1.5">
                <GitCompare className="h-3.5 w-3.5" />
                Value Demo
              </TabsTrigger>
              <TabsTrigger value="history">Case History</TabsTrigger>
            </TabsList>

            <TabsContent value="queue">
              <CaseQueue
                cases={mockCases.filter(c => c.status === 'pending' || c.status === 'in-review')}
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

            <TabsContent value="history">
              <CaseQueue
                cases={mockCases.filter(c => c.status === 'approved' || c.status === 'rejected')}
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
