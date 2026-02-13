import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CaseQueue } from '@/components/CaseQueue';
import { AuditDetail } from '@/components/AuditDetail';
import { PatternAnalysis } from '@/components/PatternAnalysis';
import { AuditPostureToggle } from '@/components/AuditPostureToggle';
import { SOUPYConfigDialog } from '@/components/SOUPYConfigDialog';
import { mockCases, mockPatterns, defaultSOUPYConfig } from '@/lib/mockData';
import type { AuditCase, AuditPosture, SOUPYConfig } from '@/lib/types';
import { Scale, Brain } from 'lucide-react';

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
      <main className="container mx-auto px-8 py-6">
        {selectedCase && activeTab === 'audit' ? (
          <AuditDetail auditCase={selectedCase} onBack={handleBack} posture={posture} />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="queue">Case Queue</TabsTrigger>
              <TabsTrigger value="patterns">Pattern Analysis</TabsTrigger>
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
