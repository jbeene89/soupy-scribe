import { useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { Scale, LogOut, Database, Brain, Stethoscope, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAdminContext } from './AdminContext';

export function AdminLayout() {
  const { isAuthenticated, loading, session } = useAuth();
  const navigate = useNavigate();
  const { appMode, liveCases } = useAdminContext();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    if (!session?.user) return;
    const loadUnread = async () => {
      const { data: isAdmin } = await supabase.rpc('is_soupy_admin', { _user_id: session.user.id });
      const query = supabase.from('messages').select('id', { count: 'exact', head: true }).eq('status', 'unread');
      // Admin sees all unread; user sees their own replies (replied messages they haven't opened)
      if (!isAdmin) {
        // For users: show count of replies received (status=replied) where they haven't viewed yet — using updated_at proxy
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('sender_id', session.user.id)
          .eq('status', 'replied');
        setUnreadCount(count || 0);
      } else {
        const { count } = await query;
        setUnreadCount(count || 0);
      }
    };
    loadUnread();
    const channel = supabase
      .channel('header-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadUnread)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

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
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground relative"
              onClick={() => navigate('/app/inbox')}
              title="Inbox"
            >
              <Inbox className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Inbox</span>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>

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
