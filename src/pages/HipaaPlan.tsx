import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Server, Lock, FileText, AlertTriangle, Map } from 'lucide-react';

/**
 * Personal reference page — plain-language description of how this app
 * currently handles PHI, what's still cloud-dependent, and the path to
 * a fully local-only deployment. Not linked from public navigation.
 */

export default function HipaaPlan() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-semibold">HIPAA Posture & Local-Only Plan</span>
          <span className="ml-auto text-xs text-muted-foreground">Personal reference · not customer-facing</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>What this page is</CardTitle>
            <CardDescription>
              A plain-English snapshot of how PHI moves through the system today, and the plan to
              make it run entirely on your own hardware so no patient record ever leaves the building.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /> What is in place today</CardTitle>
            <CardDescription>The HIPAA Technical Safeguards that are already enforced.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Item title="Access control (§164.312(a))">
              Every protected page is gated behind a real sign-in. Idle sessions sign out after
              15 minutes with a 60-second warning. Roles are stored in a separate table so a
              compromised profile cannot grant itself admin.
            </Item>
            <Item title="Audit controls (§164.312(b))">
              Every read, write, upload, download, export, and AI analysis of patient data is
              appended to a tamper-evident access log. Users see their own activity at
              <code className="mx-1 px-1 rounded bg-muted">/app/compliance</code>; admins see all access.
            </Item>
            <Item title="Integrity (§164.312(c))">
              Records are stored in row-level-security-locked tables. The patient case rows are
              keyed by a per-case access token so even another patient with the same invite cannot
              read someone else's case.
            </Item>
            <Item title="Transmission security (§164.312(e))">
              All traffic is HTTPS. File uploads use short-lived signed URLs — the storage bucket
              itself rejects anonymous reads.
            </Item>
            <Item title="Authentication">
              Password breach check (HIBP) is on. Email verification is required. Anonymous sign-ups
              are off.
            </Item>
            <Item title="PHI handling acknowledgement">
              Every signed-in user must accept the PHI policy before reaching protected pages;
              acknowledgement is versioned and re-prompted when the policy changes.
            </Item>
            <Item title="De-identification helper">
              A Safe Harbor scrubber (<code className="mx-1 px-1 rounded bg-muted">src/lib/deidentify.ts</code>)
              can strip the 18 HIPAA identifiers from any text before it is sent to an LLM, with
              a counter showing how many of each were removed.
            </Item>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> What still depends on the cloud</CardTitle>
            <CardDescription>The honest list. These are the pieces that block a "no PHI leaves my building" claim.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Bullet>
              <b>Hosting & database.</b> The app, Postgres, file storage, and auth all live on the
              managed Lovable Cloud / Supabase backend. PHI uploaded by patients sits in that
              cloud bucket.
            </Bullet>
            <Bullet>
              <b>AI inference.</b> Record analysis calls the Lovable AI Gateway (Gemini 2.5
              family). The full text of each record chunk is sent to the model provider. A BAA
              must be in place with whichever provider is upstream — otherwise this is the single
              biggest exposure point.
            </Bullet>
            <Bullet>
              <b>Email.</b> Transactional email (invites, notifications) is sent through a
              third-party email service. No PHI should ever be put in an email body.
            </Bullet>
            <Bullet>
              <b>Logs.</b> Edge-function logs, browser console logs, and request logs may briefly
              capture redacted snippets of record content.
            </Bullet>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Map className="h-5 w-5 text-primary" /> The local-only roadmap</CardTitle>
            <CardDescription>How this system gets to a deployment where the records never leave a machine you control.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Step n={1} title="Self-host the backend">
              Move off managed cloud onto a self-hosted Supabase (or plain Postgres + MinIO for
              storage) running on your own server or NAS. Same app code, same schemas, but the
              database and file bucket physically live on hardware you own.
            </Step>
            <Step n={2} title="Swap the AI gateway for a local model">
              Replace the hosted Gemini calls with a local inference server
              (Ollama / llama.cpp / vLLM) running a model strong enough for the reconciliation
              prompts — Llama 3.1 70B Instruct or Qwen 2.5 72B as the target, Llama 3.1 8B as the
              fallback for laptop-class hardware. Same edge-function shape, different endpoint.
            </Step>
            <Step n={3} title="Replace OCR / file extraction">
              Keep PDF and image text extraction local: Tesseract for OCR, pdfminer / PyMuPDF for
              PDFs, ffmpeg for any audio. No file ever uploaded to a third-party parser.
            </Step>
            <Step n={4} title="Air-gap option">
              Package the app, database, model, and OCR as a single Docker Compose stack a user
              can run on a laptop or office workstation with no internet connection. Updates go
              out as signed offline bundles.
            </Step>
            <Step n={5} title="Per-firm encryption">
              Each law firm / SIU / patient gets a vault encrypted with a key only they hold.
              Even if the host machine is seized, the records on disk are unreadable without the
              client's key.
            </Step>
            <Step n={6} title="Audit export">
              The access log exports as a signed CSV the firm or patient can hand to their own
              compliance officer, proving exactly who touched which record and when.
            </Step>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" /> Minimum hardware target</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <Bullet><b>Laptop tier (1 reviewer):</b> M-series Mac with 32 GB RAM, Llama 3.1 8B Q4. Slow but private.</Bullet>
            <Bullet><b>Office tier (small firm):</b> One workstation with a 24 GB GPU (e.g. RTX 4090) running a 70B-class model at Q4.</Bullet>
            <Bullet><b>Firm tier (multi-reviewer):</b> Server with 2× A6000 or one H100, vLLM serving the model to several seats.</Bullet>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Talking points for intake calls</CardTitle>
            <CardDescription>Short sentences you can paste into a pitch or an email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Quote>
              "Today, the system runs on a HIPAA-eligible managed cloud with a Business Associate
              Agreement, full audit logging, role-based access, session timeouts, encrypted
              transport, and per-case access tokens. We log every touch of every record for the
              six-year HIPAA retention window."
            </Quote>
            <Quote>
              "Our roadmap is a local-only deployment: same software, but the database, file
              storage, and AI model all run on hardware the firm owns. Once that ships, no
              patient record leaves your office, ever."
            </Quote>
            <Quote>
              "We do not decide whether care was wrong. We tell you what the record says, what it
              does not show, what does not reconcile, and what to ask for next."
            </Quote>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Private reference page. Edit at <code className="px-1 rounded bg-muted">src/pages/HipaaPlan.tsx</code>.
          {' '}
          <Link to="/" className="underline">Back home</Link>.
        </p>
      </main>
    </div>
  );
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-semibold">{title}</div>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2"><span className="text-primary">•</span><span>{children}</span></div>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">{n}</div>
      <div>
        <div className="font-semibold">{title}</div>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  );
}