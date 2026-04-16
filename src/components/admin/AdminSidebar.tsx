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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminContext } from './AdminContext';
import { AppModeToggle } from '@/components/provider/AppModeToggle';

const PAYER_NAV = [
  { title: 'Case Queue', path: '/app', icon: FileText },
  { title: 'Pattern Analysis', path: '/app/patterns', icon: BarChart3 },
  { title: 'Value Demo', path: '/app/comparison', icon: GitCompare },
  { title: 'Enhancement Map', path: '/app/enhancements', icon: Layers },
  { title: 'AI Pipeline', path: '/app/ai-pipeline', icon: Cpu },
  { title: 'Platform Value', path: '/app/platform', icon: LayoutDashboard },
  { title: 'Ghost Cases', path: '/app/ghost-cases', icon: Ghost },
];

const EXPERIMENTAL_NAV = [
  { title: 'OR Readiness', path: '/app/or-readiness', icon: ShieldAlert },
  { title: 'Triage Accuracy', path: '/app/triage', icon: Target },
  { title: 'Post-Op Flow', path: '/app/postop', icon: Bed },
  { title: 'ER / Acute', path: '/app/er-acute', icon: Siren },
  { title: 'Patient Advocate', path: '/app/advocate', icon: HeartHandshake },
];

const PROVIDER_NAV = [
  { title: 'Dashboard', path: '/app', icon: LayoutDashboard },
  { title: 'Case Reviews', path: '/app/cases', icon: FileText },
  { title: 'Education Insights', path: '/app/education', icon: GraduationCap },
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
          <SidebarGroupLabel>{appMode === 'provider' ? 'Provider' : 'Payer'}</SidebarGroupLabel>
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

        {/* Experimental (shared) */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-1.5">
            Experimental
            <span className="rounded-full bg-amber-500/15 text-amber-500 text-[9px] font-semibold px-1.5 py-0.5 leading-none">BETA</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {EXPERIMENTAL_NAV.map((item) => (
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
      </SidebarContent>
    </Sidebar>
  );
}
