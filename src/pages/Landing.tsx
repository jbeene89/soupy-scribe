import { useNavigate } from 'react-router-dom';
import { ModeSelectionGate } from '@/components/ModeSelectionGate';
import type { AppMode } from '@/lib/providerTypes';
import { SEO } from '@/components/SEO';

export default function Landing() {
  const navigate = useNavigate();

  const handleModeSelect = (mode: AppMode) => {
    sessionStorage.setItem('soupy_app_mode', mode);
    navigate('/app');
  };

  return (
    <>
      <SEO
        title="SOUPY Audit — AI Claim Audit for Payers, Providers & Behavioral Health"
        description="Multi-perspective AI audit engine. Run a free pre-submission claim check for denial risk, undercoding, and documentation gaps in under 60 seconds."
        path="/"
      />
      <ModeSelectionGate onSelect={handleModeSelect} />
    </>
  );
}
