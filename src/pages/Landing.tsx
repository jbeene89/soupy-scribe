import { useNavigate } from 'react-router-dom';
import { ModeSelectionGate } from '@/components/ModeSelectionGate';
import type { AppMode } from '@/lib/providerTypes';

export default function Landing() {
  const navigate = useNavigate();

  const handleModeSelect = (mode: AppMode) => {
    sessionStorage.setItem('soupy_app_mode', mode);
    navigate('/app');
  };

  return <ModeSelectionGate onSelect={handleModeSelect} />;
}
