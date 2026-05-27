import { useAdminContext } from '@/components/admin/AdminContext';
import { WriteoffAuditModule } from '@/components/operational/WriteoffAuditModule';

export default function AppWriteoffAudit() {
  const { writeoffEvents, reloadWriteoffEvents } = useAdminContext();
  return (
    <div className="p-6">
      <WriteoffAuditModule events={writeoffEvents} onChanged={reloadWriteoffEvents} />
    </div>
  );
}