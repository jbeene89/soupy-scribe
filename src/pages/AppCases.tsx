import { useAdminContext } from '@/components/admin/AdminContext';
import { CaseQueue } from '@/components/CaseQueue';
import { ProviderCaseDetail } from '@/components/provider/ProviderCaseDetail';
import { AuditDetail } from '@/components/AuditDetail';
import { ProviderCaseUpload } from '@/components/provider/ProviderCaseUpload';
import { Badge } from '@/components/ui/badge';

export default function AppCases() {
  const {
    appMode, posture, allCases, selectedCase,
    handleSelectCase, handleDeleteCase, handleBack,
    handleCaseCreated, handleDecisionMade,
  } = useAdminContext();

  if (selectedCase) {
    return appMode === 'provider' ? (
      <ProviderCaseDetail auditCase={selectedCase} onBack={handleBack} />
    ) : (
      <AuditDetail auditCase={selectedCase} onBack={handleBack} posture={posture} onDecisionMade={handleDecisionMade} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Case Reviews
          {allCases.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-[10px]">{allCases.length}</Badge>
          )}
        </h2>
        {appMode === 'provider' && <ProviderCaseUpload onCaseCreated={handleCaseCreated} />}
      </div>
      <CaseQueue
        cases={allCases}
        onSelectCase={handleSelectCase}
        selectedCaseId={selectedCase?.id}
        onDeleteCase={handleDeleteCase}
      />
    </div>
  );
}
