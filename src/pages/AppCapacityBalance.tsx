import { useAdminContext } from '@/components/admin/AdminContext';
import { CapacityBalanceModule } from '@/components/operational/CapacityBalanceModule';

export default function AppCapacityBalance() {
  const { capacityEvents, reloadCapacityEvents } = useAdminContext();
  return (
    <div className="p-6">
      <CapacityBalanceModule events={capacityEvents} onChanged={reloadCapacityEvents} />
    </div>
  );
}