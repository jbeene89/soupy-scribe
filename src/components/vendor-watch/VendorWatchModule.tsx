import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Upload, FileText, Loader2, AlertTriangle, CheckCircle2, XCircle,
  Trash2, Download, Sparkles, ShieldAlert, FileWarning,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  listVendorWatchDocuments,
  listVendorWatchFindings,
  uploadVendorWatchDocument,
  analyzeVendorWatchDocument,
  deleteVendorWatchDocument,
  getSignedDownloadUrl,
} from '@/lib/vendorWatchService';
import {
  type VendorWatchDocument,
  type VendorWatchFinding,
  type VendorWatchDocType,
  DOC_TYPE_LABELS,
} from '@/lib/vendorWatchTypes';

const SEV_STYLES: Record<string, string> = {
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
  high: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  medium: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  low: 'bg-muted text-muted-foreground border-muted-foreground/20',
};

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'vendor';
}

function downloadCsv(rows: (string | number)[][], filename: string) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map(r => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${filename}`);
}

export function VendorWatchModule() {
  const [docs, setDocs] = useState<VendorWatchDocument[]>([]);
  const [findings, setFindings] = useState<VendorWatchFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [docType, setDocType] = useState<VendorWatchDocType | 'auto'>('auto');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [d, f] = await Promise.all([
        listVendorWatchDocuments(),
        listVendorWatchFindings(),
      ]);
      setDocs(d);
      setFindings(f);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleUpload() {
    if (!pendingFile) { toast.error('Choose a file first'); return; }
    setUploading(true);
    try {
      const doc = await uploadVendorWatchDocument({
        file: pendingFile,
        vendorKey: vendorName.trim() ? slugify(vendorName) : '',
        vendorName: vendorName.trim(),
        docType,
      });
      toast.success(`Uploaded ${doc.file_name}`);
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';

      // Auto-trigger analysis if extraction succeeded.
      if (doc.status === 'pending') {
        setAnalyzingId(doc.id);
        try {
          await analyzeVendorWatchDocument(doc.id);
          toast.success('Analysis complete');
        } catch (e) {
          toast.error(`Analysis failed: ${(e as Error).message}`);
        } finally {
          setAnalyzingId(null);
        }
      } else {
        toast.warning(doc.error_message || 'Document could not be parsed');
      }
      await refresh();
      setExpandedDocId(doc.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze(doc: VendorWatchDocument) {
    setAnalyzingId(doc.id);
    try {
      await analyzeVendorWatchDocument(doc.id);
      toast.success('Analysis complete');
      await refresh();
      setExpandedDocId(doc.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAnalyzingId(null);
    }
  }

  async function handleDelete(doc: VendorWatchDocument) {
    if (!confirm(`Delete ${doc.file_name}? Findings will be removed too.`)) return;
    try {
      await deleteVendorWatchDocument(doc);
      toast.success('Deleted');
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleDownload(doc: VendorWatchDocument) {
    try {
      const url = await getSignedDownloadUrl(doc.file_path);
      window.open(url, '_blank');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function onFileSelected(files: FileList | File[] | null) {
    if (!files || !('length' in files) || files.length === 0) return;
    const f = (files as FileList)[0] ?? (files as File[])[0];
    setPendingFile(f);
  }

  // Aggregate stats.
  const stats = useMemo(() => {
    const totalImpact = findings.reduce((s, f) => s + (f.dollar_impact || 0), 0);
    const open = findings.filter(f => f.status === 'open');
    return {
      docs: docs.length,
      analyzed: docs.filter(d => d.status === 'analyzed').length,
      openFindings: open.length,
      critical: open.filter(f => f.severity === 'critical').length,
      high: open.filter(f => f.severity === 'high').length,
      dollars: totalImpact,
    };
  }, [docs, findings]);

  const findingsByDoc = useMemo(() => {
    const m = new Map<string, VendorWatchFinding[]>();
    for (const f of findings) {
      const arr = m.get(f.document_id) ?? [];
      arr.push(f);
      m.set(f.document_id, arr);
    }
    return m;
  }, [findings]);

  function exportFindingsCsv() {
    if (findings.length === 0) { toast.error('No findings to export'); return; }
    const docById = new Map(docs.map(d => [d.id, d]));
    downloadCsv([
      ['Vendor', 'Doc type', 'File', 'Severity', 'Type', 'Title', 'Detail', 'Recommended action', '$ impact', 'Status', 'Detected'],
      ...findings.map(f => {
        const d = docById.get(f.document_id);
        return [
          d?.vendor_name ?? '',
          d ? DOC_TYPE_LABELS[d.doc_type] : '',
          d?.file_name ?? '',
          f.severity,
          f.finding_type,
          f.title,
          f.detail ?? '',
          f.recommended_action ?? '',
          f.dollar_impact ?? 0,
          f.status,
          new Date(f.created_at).toLocaleString(),
        ];
      }),
    ], `vendor-watch-findings-${new Date().toISOString().slice(0,10)}.csv`);
  }

  function exportDocsCsv() {
    if (docs.length === 0) { toast.error('No documents to export'); return; }
    downloadCsv([
      ['Vendor', 'Doc type', 'File', 'Size (KB)', 'Status', 'Findings', '$ at risk', 'Uploaded'],
      ...docs.map(d => {
        const fs = findingsByDoc.get(d.id) ?? [];
        const dollars = fs.reduce((s, f) => s + (f.dollar_impact || 0), 0);
        return [
          d.vendor_name,
          DOC_TYPE_LABELS[d.doc_type],
          d.file_name,
          (d.file_size / 1024).toFixed(1),
          d.status,
          fs.length,
          Math.round(dollars),
          new Date(d.created_at).toLocaleString(),
        ];
      }),
    ], `vendor-watch-documents-${new Date().toISOString().slice(0,10)}.csv`);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendor Watch</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drop vendor documents — contracts, fee schedules, remits, EOBs, correspondence —
            and SOUPY extracts terms, flags revenue leaks, and surfaces unfavorable clauses.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportDocsCsv} disabled={docs.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Documents CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportFindingsCsv} disabled={findings.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Findings CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <StatCard label="Documents" value={stats.docs} />
        <StatCard label="Analyzed" value={stats.analyzed} />
        <StatCard label="Open findings" value={stats.openFindings} tone={stats.openFindings ? 'warn' : 'ok'} />
        <StatCard label="Critical / High" value={`${stats.critical} / ${stats.high}`} tone={stats.critical ? 'crit' : stats.high ? 'warn' : 'ok'} />
        <StatCard label="Est. annual $ at risk" value={`$${Math.round(stats.dollars).toLocaleString()}`} tone={stats.dollars > 0 ? 'warn' : 'ok'} />
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Add a vendor document
          </CardTitle>
          <CardDescription>
            Accepted: PDF, DOCX, XLSX, CSV, TXT, JSON, X12 / 835 / 837. Max 100 MB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="vw-vendor" className="text-xs">Vendor / Payer <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="vw-vendor"
                placeholder="Leave blank — SOUPY will detect from the document"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vw-doctype" className="text-xs">Document type <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={docType} onValueChange={(v) => setDocType(v as VendorWatchDocType | 'auto')}>
                <SelectTrigger id="vw-doctype"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">✨ Auto-detect (recommended)</SelectItem>
                  {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onFileSelected(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/30',
            )}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => onFileSelected(e.target.files)}
              accept=".pdf,.docx,.xlsx,.xls,.csv,.tsv,.txt,.md,.rtf,.json,.xml,.hl7,.edi,.x12,.835,.837"
            />
            {pendingFile ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">{pendingFile.name}</span>
                <span className="text-muted-foreground">({(pendingFile.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Drop a file here, or click to browse</p>
                <p className="text-xs text-muted-foreground">Text is extracted in your browser before upload.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            {pendingFile && (
              <Button variant="ghost" size="sm" onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ''; }}>
                Clear
              </Button>
            )}
            <Button onClick={handleUpload} disabled={uploading || !pendingFile}>
              {uploading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Uploading…</> : <><Sparkles className="h-4 w-4 mr-1" />Upload &amp; analyze</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
          <CardDescription>{docs.length} uploaded · click a row to view findings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {!loading && docs.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center border rounded-md">
              No vendor documents yet. Upload one above to get started.
            </div>
          )}
          {docs.map((doc) => {
            const docFindings = findingsByDoc.get(doc.id) ?? [];
            const expanded = expandedDocId === doc.id;
            const isAnalyzing = analyzingId === doc.id || doc.status === 'analyzing';
            return (
              <div key={doc.id} className="rounded-md border">
                <div className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedDocId(expanded ? null : doc.id)}>
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{doc.file_name}</span>
                      <Badge variant="outline" className="text-[10px]">{DOC_TYPE_LABELS[doc.doc_type]}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{doc.vendor_name}</Badge>
                      <StatusBadge status={doc.status} isAnalyzing={isAnalyzing} />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(doc.created_at).toLocaleString()} · {(doc.file_size / 1024).toFixed(1)} KB
                      {docFindings.length > 0 && ` · ${docFindings.length} finding${docFindings.length === 1 ? '' : 's'}`}
                    </div>
                    {doc.error_message && (
                      <div className="text-[11px] text-destructive mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {doc.error_message}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {(doc.status === 'failed' || doc.status === 'pending') && doc.raw_text && (
                      <Button size="sm" variant="outline" disabled={isAnalyzing} onClick={() => handleAnalyze(doc)}>
                        {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      </Button>
                    )}
                    {doc.status === 'analyzed' && (
                      <Button size="sm" variant="ghost" disabled={isAnalyzing} onClick={() => handleAnalyze(doc)} title="Re-analyze">
                        {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)} title="Download">
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(doc)} title="Delete">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t bg-muted/20 p-3 space-y-3">
                    {doc.analysis?.summary && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Summary</div>
                        <p className="text-sm">{doc.analysis.summary}</p>
                      </div>
                    )}

                    {doc.analysis?.cross_references && doc.analysis.cross_references.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" />
                          Cross-references to your other documents
                        </div>
                        <div className="space-y-1.5">
                          {doc.analysis.cross_references.map((x, i) => (
                            <div key={i} className="rounded-md border bg-background p-2 text-xs space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px] uppercase">{x.relationship.replace(/_/g, ' ')}</Badge>
                                {x.related_file_name && (
                                  <span className="font-medium">↔ {x.related_file_name}</span>
                                )}
                                {x.related_vendor && (
                                  <span className="text-muted-foreground">({x.related_vendor})</span>
                                )}
                                {x.severity && (
                                  <Badge className={cn('text-[10px] uppercase border ml-auto', SEV_STYLES[x.severity])}>{x.severity}</Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground">{x.detail}</p>
                              {x.dollar_impact != null && x.dollar_impact > 0 && (
                                <p className="text-amber-600 font-semibold">≈ ${Math.round(x.dollar_impact).toLocaleString()} impact</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {doc.analysis?.key_terms && doc.analysis.key_terms.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Key terms</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {doc.analysis.key_terms.map((t, i) => (
                            <div key={i} className="text-xs flex gap-2">
                              <span className="text-muted-foreground shrink-0">{t.label}:</span>
                              <span className="font-medium">{t.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {docFindings.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Findings</div>
                        {docFindings.map((f) => (
                          <div key={f.id} className="rounded-md border bg-background p-2 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={cn('text-[10px] uppercase border', SEV_STYLES[f.severity])}>
                                {f.severity}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">{f.finding_type}</Badge>
                              <span className="font-medium text-sm">{f.title}</span>
                              {f.dollar_impact != null && f.dollar_impact > 0 && (
                                <span className="ml-auto text-xs font-semibold text-amber-600">
                                  ${Math.round(f.dollar_impact).toLocaleString()}
                                </span>
                              )}
                            </div>
                            {f.detail && <p className="text-xs text-muted-foreground">{f.detail}</p>}
                            {f.recommended_action && (
                              <p className="text-xs"><span className="font-medium">Action:</span> {f.recommended_action}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      doc.status === 'analyzed' && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          No issues flagged in this document.
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone = 'ok' }: { label: string; value: string | number; tone?: 'ok' | 'warn' | 'crit' }) {
  const toneClass =
    tone === 'crit' ? 'text-destructive' :
    tone === 'warn' ? 'text-amber-600' :
    'text-foreground';
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn('text-xl font-bold mt-0.5', toneClass)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, isAnalyzing }: { status: string; isAnalyzing: boolean }) {
  if (isAnalyzing) {
    return <Badge className="text-[10px] bg-blue-500/15 text-blue-600 border-blue-500/30 border"><Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />Analyzing</Badge>;
  }
  if (status === 'analyzed') {
    return <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30 border"><CheckCircle2 className="h-2.5 w-2.5 mr-1" />Analyzed</Badge>;
  }
  if (status === 'failed') {
    return <Badge className="text-[10px] bg-destructive/15 text-destructive border-destructive/30 border"><XCircle className="h-2.5 w-2.5 mr-1" />Failed</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]"><FileWarning className="h-2.5 w-2.5 mr-1" />Pending</Badge>;
}