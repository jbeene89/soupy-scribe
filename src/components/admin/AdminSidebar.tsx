import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Shield,
  Stethoscope,
  LayoutDashboard,
  FileText,
  BarChart3,
  GitCompare,
  Layers,
  Cpu,
  Ghost,
  ShieldAlert,
  Target,
  Bed,
  GraduationCap,
  HardDrive,
  Database,
  FileDown,
  Presentation,
  Settings,
  Siren,
  HeartHandshake,
  HeartPulse,
  ClipboardCheck,
  Network,
  ScanSearch,
  Database as DatabaseIcon,
  Sparkles,
  Activity,
  Swords,
  ShieldCheck,
  Banknote,
  Scale,
  Eye,
  Clock,
  Gavel,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminContext } from './AdminContext';
import { AppModeToggle } from '@/components/provider/AppModeToggle';

const PAYER_NAV = [
  { title: 'Case Queue', path: '/app', icon: FileText },
  { title: 'System Impact', path: '/app/system-impact', icon: Network },
  { title: 'Pattern Analysis', path: '/app/patterns', icon: BarChart3 },
  { title: 'Value Demo', path: '/app/comparison', icon: GitCompare },
  { title: 'Enhancement Map', path: '/app/enhancements', icon: Layers },
  { title: 'AI Pipeline', path: '/app/ai-pipeline', icon: Cpu },
  { title: 'Platform Value', path: '/app/platform', icon: LayoutDashboard },
  { title: 'Ghost Cases', path: '/app/ghost-cases', icon: Ghost },
  { title: 'HCC Sweep', path: '/app/hcc-sweep', icon: ScanSearch },
  { title: 'Policy Time Machine', path: '/app/policy-time-machine', icon: Clock },
  { title: 'Strategic Tools', path: '/app/strategic-tools', icon: Sparkles },
];

const SHARED_NAV = [
  { title: 'Imaging Audit', path: '/app/imaging', icon: ScanSearch },
  { title: 'Policy Library', path: '/app/policy-library', icon: FileText },
  { title: 'Ops Center', path: '/app/ops-center', icon: Activity },
  { title: 'OR Readiness', path: '/app/or-readiness', icon: ShieldAlert },
  { title: 'Triage Accuracy', path: '/app/triage', icon: Target },
  { title: 'Post-Op Flow', path: '/app/postop', icon: Bed },
  { title: 'ER / Acute', path: '/app/er-acute', icon: Siren },
  { title: 'Patient Advocate', path: '/app/advocate', icon: HeartHandshake },
  { title: 'Capacity Balance', path: '/app/capacity', icon: Scale },
  { title: 'EHR Integration', path: '/app/ehr', icon: DatabaseIcon },
  { title: 'HIPAA Compliance', path: '/app/compliance', icon: ShieldCheck },
];

const PROVIDER_NAV = [
  { title: 'Dashboard', path: '/app', icon: LayoutDashboard },
  { title: 'Case Reviews', path: '/app/cases', icon: FileText },
  { title: 'System Impact', path: '/app/system-impact', icon: Network },
  { title: 'Education Insights', path: '/app/education', icon: GraduationCap },
  { title: 'Audit the Auditor', path: '/app/strategic-tools?tab=auditor', icon: Gavel },
  { title: 'Clawback Shield', path: '/app/clawback-shield', icon: Swords },
  { title: 'Recovery Cockpit', path: '/app/recovery', icon: Banknote },
  { title: 'Vendor Watch', path: '/app/vendor-watch', icon: Eye },
  { title: 'Write-off Audit', path: '/app/writeoffs', icon: Banknote },
  { title: 'Strategic Tools', path: '/app/strategic-tools', icon: Sparkles },
];

const PSYCH_NAV = [
  { title: 'Pre-Submission Audit', path: '/app', icon: ClipboardCheck },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { appMode, handleModeChange, dataSource, setDataSource } = useAdminContext();

  const isActive = (path: string) => {
    if (path === '/app') return location.pathname === '/app';
    return location.pathname.startsWith(path);
  };

  const mainNav = appMode === 'psych' ? PSYCH_NAV : appMode === 'provider' ? PROVIDER_NAV : PAYER_NAV;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Mode toggle */}
        {!collapsed && (
          <div className="px-3 pt-3 pb-1">
            <AppModeToggle mode={appMode} onChange={handleModeChange} />
          </div>
        )}

        {/* Data source toggle */}
        {!collapsed && (
          <div className="px-3 py-1">
            <div className="flex items-center rounded-md border overflow-hidden">
              <button
                onClick={() => setDataSource('mock')}
                className={cn(
                  'flex-1 px-2 py-1 text-[11px] font-medium transition-colors flex items-center justify-center gap-1',
                  dataSource === 'mock' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <HardDrive className="h-3 w-3" />
                Demo
              </button>
              <button
                onClick={() => setDataSource('live')}
                className={cn(
                  'flex-1 px-2 py-1 text-[11px] font-medium transition-colors flex items-center justify-center gap-1',
                  dataSource === 'live' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <Database className="h-3 w-3" />
                Live
              </button>
            </div>
          </div>
        )}

        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>{appMode === 'psych' ? 'Behavioral Health' : appMode === 'provider' ? 'Provider' : 'Payer'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    isActive={isActive(item.path)}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Shared (Provider + Payer) */}
        {appMode !== 'psych' && (
          <SidebarGroup>
            <SidebarGroupLabel>Shared</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {SHARED_NAV.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.path)}
                      isActive={isActive(item.path)}
                      tooltip={item.title}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
