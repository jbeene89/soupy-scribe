/**
 * NCD/LCD diff alerts.
 *
 * Tracks CMS coverage determination changes and surfaces alerts for
 * providers when a policy change retroactively affects claims they have
 * already submitted (recoupment risk) or opens new billable services.
 *
 * Demo dataset reflects the kinds of LCD/NCD changes CMS publishes weekly.
 * Production deployments would ingest the CMS coverage database directly.
 */

export interface PolicyChange {
  id: string;
  effectiveDate: string;     // ISO
  policyType: "NCD" | "LCD" | "MAC-Article";
  policyNumber: string;
  title: string;
  affectedCodes: string[];   // CPT/HCPCS
  changeType: "expanded-coverage" | "narrowed-coverage" | "new-prior-auth" | "new-documentation" | "retired";
  summary: string;
  retroactive: boolean;
  recoupmentRiskLevel: "none" | "low" | "moderate" | "high";
  newRevenueOpportunity: boolean;
}

export function getDemoPolicyChanges(): PolicyChange[] {
  return [
    {
      id: "pc-001",
      effectiveDate: "2026-04-15",
      policyType: "LCD",
      policyNumber: "L34536",
      title: "MolDX: Genomic Testing for Solid Tumors",
      affectedCodes: ["81445", "81455", "81479"],
      changeType: "narrowed-coverage",
      summary: "MolDX narrowed coverage to specific tumor types with documented stage IIIb+ disease. Prior coverage included earlier-stage cases.",
      retroactive: false,
      recoupmentRiskLevel: "moderate",
      newRevenueOpportunity: false,
    },
    {
      id: "pc-002",
      effectiveDate: "2026-03-01",
      policyType: "NCD",
      policyNumber: "20.32",
      title: "Transcatheter Aortic Valve Replacement (TAVR)",
      affectedCodes: ["33361", "33362", "33363", "33364"],
      changeType: "expanded-coverage",
      summary: "Coverage expanded to low surgical risk patients meeting heart team criteria.",
      retroactive: false,
      recoupmentRiskLevel: "none",
      newRevenueOpportunity: true,
    },
    {
      id: "pc-003",
      effectiveDate: "2026-02-10",
      policyType: "LCD",
      policyNumber: "L36377",
      title: "Wound Care: Application of Cellular and Tissue-Based Products",
      affectedCodes: ["15271", "15275", "15276", "15277"],
      changeType: "new-documentation",
      summary: "Requires documented failure of standard wound care for ≥4 weeks before CTP application. Documentation must include wound measurements at intervals.",
      retroactive: true,
      recoupmentRiskLevel: "high",
      newRevenueOpportunity: false,
    },
    {
      id: "pc-004",
      effectiveDate: "2026-01-20",
      policyType: "MAC-Article",
      policyNumber: "A57825",
      title: "Sacroiliac Joint Fusion",
      affectedCodes: ["27279", "27280"],
      changeType: "new-prior-auth",
      summary: "Prior authorization now required for all SI joint fusion procedures effective 60 days from publication.",
      retroactive: false,
      recoupmentRiskLevel: "low",
      newRevenueOpportunity: false,
    },
    {
      id: "pc-005",
      effectiveDate: "2025-12-01",
      policyType: "LCD",
      policyNumber: "L33797",
      title: "Ambulatory Continuous Glucose Monitoring",
      affectedCodes: ["95249", "95250", "95251"],
      changeType: "expanded-coverage",
      summary: "Coverage expanded to include all type 2 diabetic patients on insulin therapy.",
      retroactive: false,
      recoupmentRiskLevel: "none",
      newRevenueOpportunity: true,
    },
    {
      id: "pc-006",
      effectiveDate: "2025-11-15",
      policyType: "NCD",
      policyNumber: "210.3",
      title: "Colorectal Cancer Screening",
      affectedCodes: ["G0105", "G0121", "81528"],
      changeType: "expanded-coverage",
      summary: "Coverage expanded to age 45+. Multi-target stool DNA test frequency reduced from 3 years to 1 year for high-risk patients.",
      retroactive: false,
      recoupmentRiskLevel: "none",
      newRevenueOpportunity: true,
    },
    {
      id: "pc-007",
      effectiveDate: "2025-10-01",
      policyType: "LCD",
      policyNumber: "L34538",
      title: "Spinal Cord Stimulators",
      affectedCodes: ["63685", "63688", "63650"],
      changeType: "new-documentation",
      summary: "Requires documented psychological evaluation and trial of conservative therapies for ≥6 months. Retroactive to claims with DOS on or after Oct 1.",
      retroactive: true,
      recoupmentRiskLevel: "high",
      newRevenueOpportunity: false,
    },
  ];
}

export interface ProviderCodeMix {
  code: string;
  monthlyVolume: number;
}

export function correlatePolicyImpact(
  changes: PolicyChange[],
  providerMix: ProviderCodeMix[],
): Array<{ change: PolicyChange; affectedVolume: number; estimatedMonthlyImpact: string }> {
  const mixMap = new Map(providerMix.map(m => [m.code, m.monthlyVolume]));
  return changes
    .map(change => {
      const affectedVolume = change.affectedCodes
        .map(c => mixMap.get(c) ?? 0)
        .reduce((a, b) => a + b, 0);
      let estimatedMonthlyImpact = "—";
      if (affectedVolume > 0) {
        if (change.changeType === "expanded-coverage" || change.newRevenueOpportunity) {
          estimatedMonthlyImpact = `+${affectedVolume} eligible cases`;
        } else if (change.recoupmentRiskLevel === "high") {
          estimatedMonthlyImpact = `${affectedVolume} cases at recoupment risk`;
        } else if (change.changeType === "new-prior-auth") {
          estimatedMonthlyImpact = `${affectedVolume} cases now require PA`;
        } else {
          estimatedMonthlyImpact = `${affectedVolume} cases affected`;
        }
      }
      return { change, affectedVolume, estimatedMonthlyImpact };
    })
    .sort((a, b) => b.affectedVolume - a.affectedVolume);
}

export function getDemoProviderMix(): ProviderCodeMix[] {
  return [
    { code: "27447", monthlyVolume: 42 },
    { code: "63030", monthlyVolume: 18 },
    { code: "63685", monthlyVolume: 6 },
    { code: "63688", monthlyVolume: 4 },
    { code: "27279", monthlyVolume: 9 },
    { code: "33361", monthlyVolume: 3 },
    { code: "15271", monthlyVolume: 22 },
    { code: "15275", monthlyVolume: 11 },
    { code: "95249", monthlyVolume: 31 },
    { code: "G0105", monthlyVolume: 58 },
    { code: "G0121", monthlyVolume: 47 },
    { code: "81445", monthlyVolume: 7 },
  ];
}