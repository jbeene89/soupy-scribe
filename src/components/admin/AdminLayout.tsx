import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { Scale, LogOut, Database, Brain, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAdminContext } from './AdminContext';

export function AdminLayout() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const { appMode, liveCases } = useAdminContext();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top header bar */}
          <header className="sticky top-0 z-50 h-12 flex items-center gap-3 border-b bg-card/95 backdrop-blur-md px-4 shadow-sm">
            <SidebarTrigger className="shrink-0" />
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-primary/90">
                <Scale className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold text-foreground">SOUPY</span>
              <span className="hidden sm:inline text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                {appMode === 'provider' ? 'Provider Readiness' : 'Payment Integrity'}
              </span>
            </div>

            <div className="flex-1" />

            {/* Status pills */}
            <div className="hidden md:flex items-center gap-1.5">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded border bg-accent/5 text-accent">
                <Brain className="h-3 w-3" />
                <span className="text-[10px] font-semibold uppercase">SOUPY</span>
              </div>
              {appMode === 'provider' && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded border border-info-blue/20 bg-info-blue/5 text-info-blue">
                  <Stethoscope className="h-3 w-3" />
                  <span className="text-[10px] font-semibold uppercase">Provider</span>
                </div>
              )}
              {liveCases.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded border border-consensus/20 bg-consensus/5 text-consensus">
                  <Database className="h-3 w-3" />
                  <span className="text-[10px] font-semibold">{liveCases.length} Live</span>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => supabase.auth.signOut().then(() => navigate('/'))}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </Button>
          </header>

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
