import { useAdminContext } from '@/components/admin/AdminContext';
import { CaseQueue } from '@/components/CaseQueue';
import { AuditDetail } from '@/components/AuditDetail';
import { ProviderDashboard } from '@/components/provider/ProviderDashboard';
import { ProviderCaseDetail } from '@/components/provider/ProviderCaseDetail';
import { CaseUpload } from '@/components/CaseUpload';
import { ProviderCaseUpload } from '@/components/provider/ProviderCaseUpload';
import { PsychPracticeModule } from '@/components/psych/PsychPracticeModule';
import { SystemImpactSummaryCard } from '@/components/system-impact/SystemImpactSummaryCard';
import { Scale } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AppDashboard() {
  const {
    appMode, posture, dataSource,
    allCases, activeCases, selectedCase,
    handleSelectCase, handleDeleteCase, handleBack,
    handleCaseCreated, handleDecisionMade,
  } = useAdminContext();

  // If a case is selected, show detail
  if (selectedCase) {
    return appMode === 'provider' ? (
      <ProviderCaseDetail auditCase={selectedCase} onBack={handleBack} />
    ) : (
      <AuditDetail auditCase={selectedCase} onBack={handleBack} posture={posture} onDecisionMade={handleDecisionMade} />
    );
  }

  // Psych mode
  if (appMode === 'psych') {
    return <PsychPracticeModule />;
  }

  // Provider mode: show dashboard with case queue
  if (appMode === 'provider') {
    return (
      <div className="space-y-6">
        <SystemImpactSummaryCard />
        <Tabs defaultValue="dashboard">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="dashboard">Overview</TabsTrigger>
              <TabsTrigger value="cases">
                Case Queue
                {activeCases.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px]">{activeCases.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <ProviderCaseUpload onCaseCreated={handleCaseCreated} />
          </div>

          <TabsContent value="dashboard">
            <ProviderDashboard dataSource={dataSource} />
          </TabsContent>

          <TabsContent value="cases">
            <CaseQueue
              cases={activeCases}
              onSelectCase={handleSelectCase}
              selectedCaseId={selectedCase?.id}
              onDeleteCase={handleDeleteCase}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Payer mode: show case queue with upload
  return (
    <div className="space-y-4">
      <SystemImpactSummaryCard />
      {/* Payer value banner */}
      {posture === 'compliance-coaching' && (
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-consensus/10 shrink-0">
              <Scale className="h-5 w-5 text-consensus" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold mb-1">Claim Accuracy Program — Payer Value Proposition</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Proactive documentation guidance reduces downstream audit friction. Fewer flags, fewer appeals, dramatically reduced administrative burden.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Case Queue
          {activeCases.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-[10px]">{activeCases.length}</Badge>
          )}
        </h2>
        <CaseUpload onCaseCreated={handleCaseCreated} />
      </div>

      <CaseQueue
        cases={activeCases}
        onSelectCase={handleSelectCase}
        selectedCaseId={selectedCase?.id}
        onDeleteCase={handleDeleteCase}
      />
    </div>
  );
}