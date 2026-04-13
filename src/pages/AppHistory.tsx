import { useAdminContext } from '@/components/admin/AdminContext';
import { CaseQueue } from '@/components/CaseQueue';

export default function AppHistory() {
  const { historyCases, handleSelectCase, selectedCase, handleDeleteCase } = useAdminContext();

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Case History</h2>
      <CaseQueue
        cases={historyCases}
        onSelectCase={handleSelectCase}
        selectedCaseId={selectedCase?.id}
        onDeleteCase={handleDeleteCase}
      />
    </div>
  );
}
