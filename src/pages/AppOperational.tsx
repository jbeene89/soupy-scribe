import { useAdminContext } from '@/components/admin/AdminContext';
import { ORReadinessModule } from '@/components/operational/ORReadinessModule';
import { TriageAccuracyModule } from '@/components/operational/TriageAccuracyModule';
import { PostOpFlowModule } from '@/components/operational/PostOpFlowModule';

export function AppORReadiness() {
  const { orEvents, posture } = useAdminContext();
  return <ORReadinessModule events={orEvents} posture={posture} />;
}

export function AppTriageAccuracy() {
  const { triageEvents, posture } = useAdminContext();
  return <TriageAccuracyModule events={triageEvents} posture={posture} />;
}

export function AppPostOpFlow() {
  const { postOpEvents, posture } = useAdminContext();
  return <PostOpFlowModule events={postOpEvents} posture={posture} />;
}
