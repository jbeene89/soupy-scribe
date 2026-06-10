import { supabase } from '@/integrations/supabase/client';
import { logPhiAccess } from '@/lib/phiAccessLog';
import type { OBAuditRequest, OBAuditResult } from './obFetalTypes';

export async function runOBAudit(req: OBAuditRequest): Promise<OBAuditResult> {
  await logPhiAccess({ resourceType: 'ob_fetal_audit', resourceId: 'run', action: 'analyze' }).catch(() => {});
  const { data, error } = await supabase.functions.invoke('ob-fetal-audit', { body: req });
  if (error) throw new Error(error.message);
  if (!data || (data as any).error) throw new Error((data as any)?.error || 'Audit failed');
  return data as OBAuditResult;
}

/** Built-in demo bundle so the page is useful before any upload. Simulates a Pit augmentation
 *  that develops tachysystole at minute 60 and continues climbing — textbook violation. */
export function buildDemoOBBundle(): OBAuditRequest {
  const start = new Date();
  start.setHours(8, 0, 0, 0);
  const samples = [] as OBAuditRequest['stripSamples'];
  const events = [] as OBAuditRequest['marEvents'];
  const isoAt = (min: number) => new Date(start.getTime() + min * 60_000).toISOString();

  // 120 minutes of samples at 1/min — synthetic but realistic for the rule engine.
  for (let m = 0; m < 120; m++) {
    // Baseline 140, mild variability swing, occasional late decels after min 50.
    let fhr: number = 140 + Math.round(Math.sin(m / 3) * 4);
    // Late decel pattern starting at minute 50 — dips to 110 every ~3 min.
    if (m >= 50 && m % 3 === 1) fhr = 110;
    // After min 70, loss of variability + deeper decels.
    if (m >= 70 && m % 3 === 1) fhr = 95;
    // Contraction signal — every 3 min before min 60, every ~75 sec after (tachysystole).
    const ucPeriod = m < 60 ? 3 : 1.25;
    const uc = Math.abs(Math.sin((m * Math.PI) / ucPeriod)) > 0.8 ? 90 : 10;
    samples!.push({ t: isoAt(m), fhr, uc });
  }

  events!.push({ t: isoAt(0), medication: 'pitocin', medicationLabel: 'Oxytocin (Pitocin)', action: 'start', amount: 2, unit: 'mU/min', evidence: '08:00 Pitocin started at 2 mU/min' });
  events!.push({ t: isoAt(30), medication: 'pitocin', medicationLabel: 'Oxytocin (Pitocin)', action: 'increase', amount: 6, unit: 'mU/min', evidence: '08:30 Pitocin increased to 6 mU/min' });
  events!.push({ t: isoAt(60), medication: 'pitocin', medicationLabel: 'Oxytocin (Pitocin)', action: 'increase', amount: 10, unit: 'mU/min', evidence: '09:00 Pitocin increased to 10 mU/min' });
  events!.push({ t: isoAt(80), medication: 'pitocin', medicationLabel: 'Oxytocin (Pitocin)', action: 'increase', amount: 14, unit: 'mU/min', evidence: '09:20 Pitocin increased to 14 mU/min' });

  return {
    stripSamples: samples,
    marEvents: events,
    notesText: '08:30 Reassuring tracing per RN. 09:05 Mod variability. 09:25 Provider notified of recurrent late decels.',
    windowMinutes: 10,
  };
}
