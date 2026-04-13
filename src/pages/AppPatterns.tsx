import { useAdminContext } from '@/components/admin/AdminContext';
import { PatternAnalysis } from '@/components/PatternAnalysis';

export default function AppPatterns() {
  const { dataSource, livePatterns, mockPatternsData, handleSelectCase } = useAdminContext();

  const patterns = dataSource === 'live' && livePatterns.length > 0
    ? livePatterns.map((lp, idx) => ({
        patternId: `LIVE-${idx}`,
        physicianId: lp.physicianId,
        physicianName: lp.physicianName,
        cptCodes: lp.cptCodes,
        cases: lp.cases,
        totalCases: lp.totalCases,
        rejectionRate: lp.rejectionRate,
        totalClaimAmount: lp.avgClaimAmount * lp.totalCases,
        averageClaimAmount: lp.avgClaimAmount,
        dateRange: { start: '', end: '' },
        insights: [`Avg risk score: ${lp.avgRiskScore}`, `${lp.totalCases} case(s) analyzed`],
      }))
    : mockPatternsData;

  return <PatternAnalysis patterns={patterns} onSelectCase={handleSelectCase} />;
}
