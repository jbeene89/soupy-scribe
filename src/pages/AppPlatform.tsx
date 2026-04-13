import { ComparisonView } from '@/components/ComparisonView';
import { PlatformEnhancementMap } from '@/components/PlatformEnhancementMap';
import { AIPipelineIntegration } from '@/components/AIPipelineIntegration';
import { PlatformValueCard } from '@/components/PlatformValueCard';
import { IntegrationArchitecture } from '@/components/IntegrationArchitecture';
import { GhostCaseManager } from '@/components/GhostCaseManager';
import { EducationInsights } from '@/components/provider/EducationInsights';
import { useAdminContext } from '@/components/admin/AdminContext';

export function AppComparison() {
  return <ComparisonView />;
}

export function AppEnhancementMap() {
  return <PlatformEnhancementMap />;
}

export function AppAIPipeline() {
  return <AIPipelineIntegration />;
}

export function AppPlatformValue() {
  return (
    <div className="space-y-6">
      <PlatformValueCard />
      <IntegrationArchitecture />
    </div>
  );
}

export function AppGhostCases() {
  return <GhostCaseManager />;
}

export function AppEducation() {
  const { dataSource } = useAdminContext();
  return <EducationInsights dataSource={dataSource} />;
}
