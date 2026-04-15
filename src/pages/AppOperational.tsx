import { useAdminContext } from '@/components/admin/AdminContext';
import { ORReadinessModule } from '@/components/operational/ORReadinessModule';
import { TriageAccuracyModule } from '@/components/operational/TriageAccuracyModule';
import { PostOpFlowModule } from '@/components/operational/PostOpFlowModule';
import { ERAcuteModule } from '@/components/operational/ERAcuteModule';
import { PatientAdvocateModule } from '@/components/operational/PatientAdvocateModule';

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

export function AppERAcute() {
  const { erAcuteEvents, posture } = useAdminContext();
  return <ERAcuteModule events={erAcuteEvents} posture={posture} />;
}

export function AppPatientAdvocate() {
  const { advocateEvents, posture } = useAdminContext();
  return <PatientAdvocateModule events={advocateEvents} posture={posture} />;
}
