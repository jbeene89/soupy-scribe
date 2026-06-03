import { useEffect, useState } from 'react';
import { Linkedin, Loader2, ExternalLink, CheckCircle2, AlertCircle, Image as ImageIcon, Clock, History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import teaserImg from '@/assets/linkedin-teaser-denial-economy.jpg';

const DEFAULT_LINK = 'https://soupyaudit.com/methodology/denial-economy';

const DEFAULT_TEXT = `Most denials aren't mysteries. They're the predictable output of a system that profits from friction.

I wrote a short piece on the denial economy — why claims get denied, what the data already shows, and what a shadow audit reveals about your own book of business before your payer uses it against you.

If you want to see what SOUPY would have flagged on a small de-identified sample of your claims, I'll run a confidential shadow audit. No integration, no commitment — just the findings.

Read the full piece + request a shadow audit:`;

export default function AppLinkedInShare() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [linkUrl, setLinkUrl] = useState(DEFAULT_LINK);
  const [includeImage, setIncludeImage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; postUrl?: string; error?: string } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadHistory() {
    setHistoryLoading(true);
    const { data } = await supabase
      .from('linkedin_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(25);
    setHistory(data || []);
    setHistoryLoading(false);
  }

  useEffect(() => {
    loadHistory();
    const ch = supabase
      .channel('linkedin-posts-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'linkedin_posts' }, () => loadHistory())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function fetchImageBase64(): Promise<{ b64: string; type: string }> {
    const res = await fetch(teaserImg);
    const blob = await res.blob();
    const type = blob.type || 'image/jpeg';
    const buf = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return { b64: btoa(binary), type };
  }

  async function publish() {
    setLoading(true);
    setResult(null);
    try {
      let imageBase64: string | undefined;
      let imageContentType: string | undefined;
      if (includeImage) {
        const img = await fetchImageBase64();
        imageBase64 = img.b64;
        imageContentType = img.type;
      }
      const { data, error } = await supabase.functions.invoke('linkedin-share-teaser', {
        body: {
          text,
          linkUrl,
          imageBase64,
          imageContentType,
          imageAltText: 'SOUPY Audit — The Denial Economy',
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult({ ok: true, postUrl: data?.postUrl });
    } catch (e: any) {
      setResult({ ok: false, error: e?.message || String(e) });
    } finally {
      setLoading(false);
      loadHistory();
    }
  }

  const charCount = text.length + (linkUrl && !text.includes(linkUrl) ? linkUrl.length + 2 : 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Linkedin className="h-5 w-5 text-[#0A66C2]" />
          <h1 className="text-2xl font-bold text-foreground">LinkedIn Teaser</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Publish the Denial Economy op-ed teaser with the shadow audit call-to-action straight to your LinkedIn feed.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Composer */}
        <Card className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="text">Post text</Label>
            <Textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="font-sans text-sm leading-relaxed"
            />
            <p className={`text-[11px] ${charCount > 3000 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {charCount} / 3000 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="link">Link to include</Label>
            <Input
              id="link"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://soupyaudit.com/methodology/denial-economy"
            />
            <p className="text-[11px] text-muted-foreground">
              Appended to the post if not already included. LinkedIn will render a preview card.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeImage}
              onChange={(e) => setIncludeImage(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-foreground">
              Attach teaser image
              <span className="block text-[11px] text-muted-foreground">
                Replaces the auto-generated link preview with a custom graphic.
              </span>
            </span>
          </label>

          <Button onClick={publish} disabled={loading || !text.trim() || charCount > 3000} className="w-full">
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Publishing…</>
            ) : (
              <><Linkedin className="h-4 w-4 mr-2" />Publish to LinkedIn</>
            )}
          </Button>

          {result?.ok && (
            <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-foreground font-medium">Published.</p>
                {result.postUrl && (
                  <a
                    href={result.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0A66C2] hover:underline inline-flex items-center gap-1 text-xs"
                  >
                    View on LinkedIn <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {result && !result.ok && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-foreground font-medium">Couldn't publish.</p>
                <p className="text-xs text-muted-foreground break-words">{result.error}</p>
              </div>
            </div>
          )}
        </Card>

        {/* Preview */}
        <Card className="p-5 space-y-3 bg-muted/30">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5" />
            Preview
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#0A66C2] to-[#004182] flex items-center justify-center text-white font-bold text-sm">
                  J
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">You</p>
                  <p className="text-[11px] text-muted-foreground">Now • Public</p>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">{text}</p>
              {linkUrl && !text.includes(linkUrl) && (
                <p className="text-sm text-[#0A66C2] break-all">{linkUrl}</p>
              )}
            </div>

            {includeImage && (
              <img
                src={teaserImg}
                alt="SOUPY Audit — The Denial Economy"
                className="w-full h-auto border-t"
                loading="lazy"
              />
            )}

            {!includeImage && linkUrl && (
              <div className="border-t bg-muted/50 p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">soupyaudit.com</p>
                <p className="text-sm font-semibold text-foreground">The Denial Economy</p>
                <p className="text-xs text-muted-foreground">
                  LinkedIn will auto-generate this preview card from the link.
                </p>
              </div>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Posts as your connected LinkedIn account (John's LinkedIn). Visibility: Public.
          </p>
        </Card>
      </div>

      {/* Publishing status panel */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Publishing status</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={loadHistory} disabled={historyLoading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${historyLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No LinkedIn posts yet. Publish one above to see it tracked here.
          </p>
        ) : (
          <div className="divide-y border rounded-md overflow-hidden">
            {history.map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'published') {
    return (
      <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Published
      </Badge>
    );
  }
  if (status === 'failed') {
    return (
      <Badge variant="secondary" className="bg-destructive/15 text-destructive border border-destructive/30">
        <AlertCircle className="h-3 w-3 mr-1" /> Failed
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
      <Clock className="h-3 w-3 mr-1" /> Queued
    </Badge>
  );
}

function fmt(ts?: string | null) {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return ts; }
}

function PostRow({ post }: { post: any }) {
  const timestamp = post.published_at || post.failed_at || post.queued_at || post.created_at;
  return (
    <div className="p-3 bg-card space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground line-clamp-2 whitespace-pre-wrap">{post.text_snippet}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
            <span>{fmt(timestamp)}</span>
            {post.has_image && <span>• Image attached</span>}
            {post.link_url && (
              <a href={post.link_url} target="_blank" rel="noreferrer" className="text-[#0A66C2] hover:underline truncate max-w-[200px]">
                {post.link_url}
              </a>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <StatusBadge status={post.status} />
          {post.status === 'published' && post.post_url && (
            <a
              href={post.post_url}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-[#0A66C2] hover:underline inline-flex items-center gap-1"
            >
              View <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
      {post.status === 'failed' && post.error_message && (
        <div className="text-[11px] text-destructive bg-destructive/5 border border-destructive/20 rounded p-2 break-words">
          {post.error_message}
        </div>
      )}
    </div>
  );
}