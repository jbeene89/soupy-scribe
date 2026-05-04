import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AuditCase, AuditPosture, SOUPYConfig } from '@/lib/types';
import type { AppMode } from '@/lib/providerTypes';
import type { ORReadinessEvent, TriageAccuracyEvent, PostOpFlowEvent, ERAcuteEvent, PatientAdvocateEvent } from '@/lib/operationalTypes';
import type { ImagingFinding } from '@/lib/imagingTypes';
import type { RevenueIntegrityFinding } from '@/lib/revenueIntegrityTypes';
import type { CDIFinding } from '@/lib/cdiTypes';
import { mockCases, mockPatterns, defaultSOUPYConfig } from '@/lib/mockData';
import { deleteCase, deriveLivePatterns, type LivePhysicianPattern } from '@/lib/soupyEngineService';
import { fetchCases, fetchCase } from '@/lib/caseService';
import { fetchORReadinessEvents, fetchTriageAccuracyEvents, fetchPostOpFlowEvents } from '@/lib/operationalService';
import { fetchERAcuteEvents, fetchPatientAdvocateEvents } from '@/lib/erAcuteService';
import { fetchImagingFindings } from '@/lib/imagingService';
import { listRevenueIntegrityFindings } from '@/lib/revenueIntegrityService';
import { listAllCDIFindings } from '@/lib/cdiService';
import { mockORReadinessEvents, mockTriageEvents, mockPostOpFlowEvents } from '@/lib/operationalMockData';
import { mockERAcuteEvents, mockPatientAdvocateEvents } from '@/lib/erAcuteMockData';
import { mockImagingFindings } from '@/lib/imagingMockData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdminContextType {
  appMode: AppMode;
  handleModeChange: (mode: AppMode) => void;
  posture: AuditPosture;
  dataSource: 'mock' | 'live';
  setDataSource: (ds: 'mock' | 'live') => void;
  soupyConfig: SOUPYConfig;
  setSoupyConfig: (c: SOUPYConfig) => void;

  // Cases
  allCases: AuditCase[];
  liveCases: AuditCase[];
  activeCases: AuditCase[];
  historyCases: AuditCase[];
  loadingLive: boolean;
  selectedCase: AuditCase | null;
  handleSelectCase: (c: AuditCase) => Promise<void>;
  handleDeleteCase: (id: string) => Promise<void>;
  handleBack: () => void;
  handleCaseCreated: (id: string) => Promise<void>;
  handleDecisionMade: (outcome: 'approved' | 'rejected' | 'info-requested') => void;
  loadLiveCases: () => Promise<void>;

  // Patterns
  livePatterns: LivePhysicianPattern[];
  mockPatternsData: typeof mockPatterns;

  // Operational
  orEvents: ORReadinessEvent[];
  triageEvents: TriageAccuracyEvent[];
  postOpEvents: PostOpFlowEvent[];
  erAcuteEvents: ERAcuteEvent[];
  advocateEvents: PatientAdvocateEvent[];
  imagingFindings: ImagingFinding[];
  reloadImagingFindings: () => Promise<void>;
  revenueIntegrityFindings: RevenueIntegrityFinding[];
  cdiFindings: CDIFinding[];
  reloadRevenueIntegrity: () => Promise<void>;
  reloadCDIFindings: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType>(null!);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [appMode, setAppMode] = useState<AppMode>(
    () => (sessionStorage.getItem('soupy_app_mode') as AppMode) || 'payer'
  );
  const [dataSource, setDataSource] = useState<'mock' | 'live'>('mock');
  const [soupyConfig, setSoupyConfig] = useState<SOUPYConfig>(defaultSOUPYConfig);
  const [selectedCase, setSelectedCase] = useState<AuditCase | null>(null);

  const posture: AuditPosture = appMode === 'provider' ? 'compliance-coaching' : 'payment-integrity';

  // Live data
  const [liveCases, setLiveCases] = useState<AuditCase[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  const [livePatterns, setLivePatterns] = useState<LivePhysicianPattern[]>([]);
  const [liveOREvents, setLiveOREvents] = useState<ORReadinessEvent[]>([]);
  const [liveTriageEvents, setLiveTriageEvents] = useState<TriageAccuracyEvent[]>([]);
  const [livePostOpEvents, setLivePostOpEvents] = useState<PostOpFlowEvent[]>([]);
  const [liveERAcuteEvents, setLiveERAcuteEvents] = useState<ERAcuteEvent[]>([]);
  const [liveAdvocateEvents, setLiveAdvocateEvents] = useState<PatientAdvocateEvent[]>([]);
  const [liveImagingFindings, setLiveImagingFindings] = useState<ImagingFinding[]>([]);
  const [liveRIFindings, setLiveRIFindings] = useState<RevenueIntegrityFinding[]>([]);
  const [liveCDIFindings, setLiveCDIFindings] = useState<CDIFinding[]>([]);

  const loadLiveCases = useCallback(async () => {
    setLoadingLive(true);
    try {
      const cases = await fetchCases();
      setLiveCases(cases);
      setLivePatterns(deriveLivePatterns(cases));
    } catch (err) {
      console.error('Failed to load live cases:', err);
    } finally {
      setLoadingLive(false);
    }
  }, []);

  const loadLiveOperationalEvents = useCallback(async () => {
    try {
      const [or, triage, postop, erAcute, advocate] = await Promise.all([
        fetchORReadinessEvents(),
        fetchTriageAccuracyEvents(),
        fetchPostOpFlowEvents(),
        fetchERAcuteEvents(),
        fetchPatientAdvocateEvents(),
      ]);
      setLiveOREvents(or);
      setLiveTriageEvents(triage);
      setLivePostOpEvents(postop);
      setLiveERAcuteEvents(erAcute);
      setLiveAdvocateEvents(advocate);
    } catch (err) {
      console.error('Failed to load operational events:', err);
    }
  }, []);

  const loadLiveImagingFindings = useCallback(async () => {
    try {
      const findings = await fetchImagingFindings();
      setLiveImagingFindings(findings);
    } catch (err) {
      console.error('Failed to load imaging findings:', err);
    }
  }, []);

  const loadLiveRIFindings = useCallback(async () => {
    try {
      const findings = await listRevenueIntegrityFindings();
      setLiveRIFindings(findings);
    } catch (err) {
      console.error('Failed to load revenue integrity findings:', err);
    }
  }, []);

  const loadLiveCDIFindings = useCallback(async () => {
    try {
      const findings = await listAllCDIFindings();
      setLiveCDIFindings(findings);
    } catch (err) {
      console.error('Failed to load CDI findings:', err);
    }
  }, []);

  useEffect(() => {
    loadLiveCases();
    loadLiveOperationalEvents();
    loadLiveImagingFindings();
    loadLiveRIFindings();
    loadLiveCDIFindings();

    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_cases' }, () => loadLiveCases())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'processing_queue' }, () => loadLiveCases())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'or_readiness_events' }, () => loadLiveOperationalEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'triage_accuracy_events' }, () => loadLiveOperationalEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'postop_flow_events' }, () => loadLiveOperationalEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'er_acute_events' }, () => loadLiveOperationalEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_advocate_events' }, () => loadLiveOperationalEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'imaging_findings' }, () => loadLiveImagingFindings())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revenue_integrity_findings' }, () => loadLiveRIFindings())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cdi_findings' }, () => loadLiveCDIFindings())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadLiveCases, loadLiveOperationalEvents, loadLiveImagingFindings, loadLiveRIFindings, loadLiveCDIFindings]);

  const allCases = dataSource === 'live' ? liveCases : [...mockCases, ...liveCases];
  const activeCases = allCases.filter(c => c.status === 'pending' || c.status === 'in-review');
  const historyCases = allCases.filter(c => c.status === 'approved' || c.status === 'rejected');

  const orEvents = dataSource === 'live' ? liveOREvents : [...mockORReadinessEvents, ...liveOREvents];
  const triageEvents = dataSource === 'live' ? liveTriageEvents : [...mockTriageEvents, ...liveTriageEvents];
  const postOpEvents = dataSource === 'live' ? livePostOpEvents : [...mockPostOpFlowEvents, ...livePostOpEvents];
  const erAcuteEvents = dataSource === 'live' ? liveERAcuteEvents : [...mockERAcuteEvents, ...liveERAcuteEvents];
  const advocateEvents = dataSource === 'live' ? liveAdvocateEvents : [...mockPatientAdvocateEvents, ...liveAdvocateEvents];
  const imagingFindings = dataSource === 'live' ? liveImagingFindings : [...mockImagingFindings, ...liveImagingFindings];
  const revenueIntegrityFindings = liveRIFindings;
  const cdiFindings = liveCDIFindings;

  const handleModeChange = (mode: AppMode) => {
    sessionStorage.setItem('soupy_app_mode', mode);
    setAppMode(mode);
    setSelectedCase(null);
  };

  const handleSelectCase = async (c: AuditCase) => {
    if (liveCases.some(lc => lc.id === c.id)) {
      const fresh = await fetchCase(c.id);
      if (fresh) { setSelectedCase(fresh); return; }
    }
    setSelectedCase(c);
  };

  const handleDeleteCase = async (caseId: string) => {
    try {
      await deleteCase(caseId);
      toast.success('Case deleted');
      if (selectedCase?.id === caseId) setSelectedCase(null);
      loadLiveCases();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete case');
    }
  };

  const handleBack = () => {
    setSelectedCase(null);
    loadLiveCases();
  };

  const handleCaseCreated = async (caseId: string) => {
    await loadLiveCases();
    const newCase = await fetchCase(caseId);
    if (newCase) setSelectedCase(newCase);
  };

  const handleDecisionMade = (outcome: 'approved' | 'rejected' | 'info-requested') => {
    if (!selectedCase) return;
    const currentCases = allCases.filter(c => c.status === 'pending' || c.status === 'in-review');
    const idx = currentCases.findIndex(c => c.id === selectedCase.id);
    const next = currentCases[idx + 1] || currentCases[idx - 1];
    if (next) { handleSelectCase(next); } else { handleBack(); toast.info('No more cases in queue'); }
  };

  return (
    <AdminContext.Provider value={{
      appMode, handleModeChange, posture, dataSource, setDataSource,
      soupyConfig, setSoupyConfig,
      allCases, liveCases, activeCases, historyCases, loadingLive,
      selectedCase, handleSelectCase, handleDeleteCase, handleBack,
      handleCaseCreated, handleDecisionMade, loadLiveCases,
      livePatterns, mockPatternsData: mockPatterns,
      orEvents, triageEvents, postOpEvents, erAcuteEvents, advocateEvents,
      imagingFindings, reloadImagingFindings: loadLiveImagingFindings,
      revenueIntegrityFindings, cdiFindings,
      reloadRevenueIntegrity: loadLiveRIFindings,
      reloadCDIFindings: loadLiveCDIFindings,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdminContext() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdminContext must be used within AdminProvider');
  return ctx;
}
