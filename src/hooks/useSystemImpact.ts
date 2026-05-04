import { useMemo } from 'react';
import { useAdminContext } from '@/components/admin/AdminContext';
import {
  buildImpactEntries,
  rollupByCategory,
  rollupByPhysician,
  rollupByPatient,
  detectPatterns,
  timelineFor,
  relatedCounts,
  type ImpactEntry,
  type ImpactCategory,
} from '@/lib/systemImpactService';

export function useSystemImpact() {
  const {
    allCases,
    orEvents,
    triageEvents,
    postOpEvents,
    erAcuteEvents,
    advocateEvents,
    imagingFindings,
    revenueIntegrityFindings,
    cdiFindings,
  } = useAdminContext();

  return useMemo(() => {
    const entries = buildImpactEntries({
      cases: allCases,
      orEvents,
      triageEvents,
      postOpEvents,
      erAcuteEvents,
      advocateEvents,
      imagingFindings,
      revenueIntegrityFindings,
      cdiFindings,
    });
    return {
      entries,
      categories: rollupByCategory(entries),
      physicians: rollupByPhysician(entries),
      patients: rollupByPatient(entries),
      patterns: detectPatterns(entries),
      totalLoss: entries.reduce((s, e) => s + e.estimated_loss, 0),
      timelineFor: (f: { patient_id?: string; physician_name?: string }) =>
        timelineFor(entries, f),
      relatedCounts: (
        f: { patient_id?: string; physician_name?: string },
        excludeCategory?: ImpactCategory
      ) => relatedCounts(entries, f, excludeCategory),
    };
  }, [allCases, orEvents, triageEvents, postOpEvents, erAcuteEvents, advocateEvents, imagingFindings, revenueIntegrityFindings, cdiFindings]);
}

export type { ImpactEntry, ImpactCategory };