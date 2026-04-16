import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Mail, Send, Reply, Inbox as InboxIcon, CheckCircle2, Loader2 } from 'lucide-react';
import { z } from 'zod';

interface Message {
  id: string;
  sender_id: string | null;
  sender_email: string | null;
  sender_name: string | null;
  subject: string;
  body: string;
  status: 'unread' | 'read' | 'replied';
  admin_reply: string | null;
  admin_replied_at: string | null;
  created_at: string;
}

const messageSchema = z.object({
  subject: z.string().trim().min(1, 'Subject required').max(200, 'Subject too long'),
  body: z.string().trim().min(1, 'Message required').max(5000, 'Message too long'),
});

const replySchema = z.object({
  reply: z.string().trim().min(1, 'Reply required').max(5000, 'Reply too long'),
});

export default function AppInbox() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const checkAdmin = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase.rpc('is_soupy_admin', { _user_id: session.user.id });
    setIsAdmin(!!data);
  }, [session]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Could not load messages');
    } else {
      setMessages((data as Message[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAdmin();
    loadMessages();

    const channel = supabase
      .channel('messages-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkAdmin, loadMessages]);

  const sendMessage = async () => {
    const parsed = messageSchema.safeParse({ subject, body });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    if (!session?.user) {
      toast.error('You must be signed in');
      return;
    }
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: session.user.id,
      sender_email: session.user.email,
      sender_name: session.user.user_metadata?.full_name || session.user.email,
      subject: parsed.data.subject,
      body: parsed.data.body,
    });
    setSending(false);
    if (error) {
      toast.error('Failed to send: ' + error.message);
      return;
    }
    toast.success('Message sent');
    setSubject('');
    setBody('');
    setComposing(false);
    loadMessages();
  };

  const sendReply = async (msg: Message) => {
    const parsed = replySchema.safeParse({ reply });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSending(true);
    const { error } = await supabase
      .from('messages')
      .update({
        admin_reply: parsed.data.reply,
        admin_replied_at: new Date().toISOString(),
        replied_by: session?.user.id,
        status: 'replied',
      })
      .eq('id', msg.id);
    setSending(false);
    if (error) {
      toast.error('Reply failed: ' + error.message);
      return;
    }
    toast.success('Reply sent');
    setReply('');
    loadMessages();
  };

  const markRead = async (msg: Message) => {
    if (msg.status !== 'unread') return;
    await supabase.from('messages').update({ status: 'read' }).eq('id', msg.id);
    loadMessages();
  };

  const selected = messages.find((m) => m.id === selectedId);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <InboxIcon className="h-6 w-6" /> Inbox
            {isAdmin && <Badge variant="secondary" className="ml-2">Admin View</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? 'All user messages — reply directly inside SOUPY.'
              : 'Send a message to the SOUPY team. Replies appear here.'}
          </p>
        </div>
        {!isAdmin && (
          <Button onClick={() => setComposing(true)} className="gap-2">
            <Send className="h-4 w-4" /> New Message
          </Button>
        )}
      </div>

      {composing && !isAdmin && (
        <Card className="p-4 space-y-3 border-primary/40">
          <div className="font-semibold text-sm">New Message</div>
          <Input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
          />
          <Textarea
            placeholder="What's on your mind?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={5000}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setComposing(false)}>Cancel</Button>
            <Button onClick={sendMessage} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Message list */}
        <Card className="p-2 md:col-span-1 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No messages yet.
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedId(m.id);
                    if (isAdmin) markRead(m);
                  }}
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    selectedId === m.id ? 'bg-accent border-primary/40' : 'border-transparent hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm truncate">{m.subject}</div>
                    {m.status === 'unread' && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    {m.status === 'replied' && <CheckCircle2 className="h-3.5 w-3.5 text-consensus shrink-0" />}
                  </div>
                  {isAdmin && (
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      from {m.sender_name || m.sender_email || 'unknown'}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground truncate mt-1">{m.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Detail */}
        <Card className="p-4 md:col-span-2 max-h-[70vh] overflow-y-auto">
          {!selected ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              Select a message to read.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-lg font-semibold">{selected.subject}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {isAdmin && (
                    <>From: {selected.sender_name || selected.sender_email} • </>
                  )}
                  {new Date(selected.created_at).toLocaleString()}
                </div>
              </div>
              <div className="text-sm whitespace-pre-wrap p-3 rounded bg-muted/40 border">
                {selected.body}
              </div>

              {selected.admin_reply && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                    <Reply className="h-3 w-3" /> Reply from SOUPY team
                  </div>
                  <div className="text-sm whitespace-pre-wrap p-3 rounded bg-primary/5 border border-primary/20">
                    {selected.admin_reply}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {selected.admin_replied_at && new Date(selected.admin_replied_at).toLocaleString()}
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    {selected.admin_reply ? 'Send another reply' : 'Reply'}
                  </div>
                  <Textarea
                    placeholder="Type your reply…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={4}
                    maxLength={5000}
                  />
                  <Button onClick={() => sendReply(selected)} disabled={sending} className="gap-2">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Reply className="h-4 w-4" />}
                    Send Reply
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
