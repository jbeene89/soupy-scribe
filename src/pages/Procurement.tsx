import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText, Lock, Server, Map, Mail } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SEO } from '@/components/SEO';

/**
 * Procurement-facing security & compliance page for law-firm IT / risk reviewers.
 * Distinct from /security (which is the public vuln-disclosure page) and from
 * the internal /hipaa-plan reference page. Read-only marketing facts only.
 */

const CONTACT_EMAIL = 'firms@soupyaudit.com';

export default function Procurement() {
  return (
    <>
      <SEO
        title="Security & BAA — SOUPY Audit for Law Firms"
        description="HIPAA technical safeguards, BAA availability, access logging, and the local-only deployment roadmap for SOUPY Audit's law-firm review service."
        path="/procurement"
      />
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card/30 backdrop-blur">
          <div className="container max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
            <Link to="/for-law-firms" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              For Law Firms
            </Link>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Security & BAA</span>
            </div>
          </div>
        </header>

        <section className="container max-w-4xl mx-auto px-6 py-16 space-y-8">
          <div>
            <Badge variant="outline" className="mb-4 font-mono text-[10px] uppercase tracking-wider">
              For firm IT, risk, and procurement
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight mb-4">Security posture and BAA</h1>
            <p className="text-muted-foreground leading-relaxed">
              SOUPY Audit handles protected health information under the HIPAA Security Rule's
              technical safeguards. This page lists the controls in place today and the
              roadmap toward an on-premise option for firms that require it.
            </p>
          </div>

          <Card className="p-6 bg-card/40 border-border space-y-3">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold">Business Associate Agreement</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  A click-through BAA is presented at firm account creation. Countersigned
                  PDF is delivered by email. No chart is accepted before the BAA is on file.
                </p>
              </div>
            </div>
            <div className="pl-8">
              <Button asChild variant="outline" size="sm">
                <a href={`mailto:${CONTACT_EMAIL}?subject=BAA%20request`}>
                  <Mail className="h-3 w-3 mr-2" />
                  Request the BAA in advance
                </a>
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-card/40 border-border space-y-4">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-primary mt-0.5" />
              <h2 className="text-lg font-semibold">Technical safeguards in place today</h2>
            </div>
            <ul className="text-sm text-muted-foreground space-y-3 pl-8">
              <Bullet title="Access control § 164.312(a)">
                Every protected route requires sign-in. Idle sessions sign out after 15 minutes.
                Roles live in a separate table so a compromised profile cannot grant itself admin.
              </Bullet>
              <Bullet title="Audit controls § 164.312(b)">
                Every read, write, upload, export, and AI analysis of patient data is appended to
                a tamper-evident access log retained for the 6-year HIPAA window.
              </Bullet>
              <Bullet title="Integrity § 164.312(c)">
                Records are stored in row-level-security-locked tables. Each matter is keyed by
                a per-case access token so cross-tenant reads are not possible.
              </Bullet>
              <Bullet title="Transmission security § 164.312(e)">
                All traffic is HTTPS. File uploads use short-lived signed URLs;
                anonymous bucket reads are rejected.
              </Bullet>
              <Bullet title="Authentication">
                Email verification required. Password breach check (HIBP) enabled. Anonymous
                sign-ups disabled.
              </Bullet>
              <Bullet title="PHI handling acknowledgement">
                Every signed-in user must accept a versioned PHI policy before reaching
                protected pages.
              </Bullet>
            </ul>
          </Card>

          <Card className="p-6 bg-card/40 border-border space-y-4">
            <div className="flex items-start gap-3">
              <Server className="h-5 w-5 text-primary mt-0.5" />
              <h2 className="text-lg font-semibold">Where the data lives today</h2>
            </div>
            <p className="text-sm text-muted-foreground pl-8">
              SOUPY Audit currently runs on a HIPAA-eligible managed cloud (Supabase / Postgres
              for application data and files, Lovable AI Gateway for model inference) with a
              Business Associate Agreement in place with the upstream provider. Records uploaded
              by a firm are stored encrypted at rest and in transit, and are isolated by matter.
            </p>
          </Card>

          <Card className="p-6 bg-card/40 border-border space-y-4">
            <div className="flex items-start gap-3">
              <Map className="h-5 w-5 text-primary mt-0.5" />
              <h2 className="text-lg font-semibold">Roadmap: on-premise option</h2>
            </div>
            <p className="text-sm text-muted-foreground pl-8 mb-2">
              For firms whose policy requires that no chart leaves the office, an on-premise
              deployment is in progress:
            </p>
            <ol className="text-sm text-muted-foreground space-y-2 pl-8 list-decimal pl-12">
              <li>Self-hosted backend (Postgres + object storage) on firm-owned hardware.</li>
              <li>Local AI inference (Llama 3.1 70B-class) replacing the hosted gateway.</li>
              <li>Local OCR and PDF parsing — no third-party document services.</li>
              <li>Air-gap option packaged as a single Docker stack.</li>
              <li>Per-firm encryption keys, exportable signed audit log.</li>
            </ol>
          </Card>

          <Card className="p-6 bg-card/40 border-border space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Scope statement</h2>
            <p className="text-sm text-muted-foreground">
              Every deliverable is labeled a <strong className="text-foreground">records reconciliation</strong>.
              It is not a legal opinion, not a medical opinion, and not a Florida § 766.203
              corroborating expert affidavit. The reviewing nurse-paralegal signs as <em>RN, paralegal</em>
              — not as an expert witness.
            </p>
          </Card>

          <Card className="p-8 bg-gradient-to-br from-primary/10 to-card/40 border-primary/20 text-center space-y-4">
            <h2 className="text-lg font-semibold">Procurement questionnaires welcome</h2>
            <p className="text-sm text-muted-foreground">
              Send your standard security questionnaire (CAIQ, SIG-Lite, custom) and we'll return it.
            </p>
            <Button asChild>
              <a href={`mailto:${CONTACT_EMAIL}?subject=Security%20questionnaire`}>
                <Mail className="h-4 w-4 mr-2" />
                {CONTACT_EMAIL}
              </a>
            </Button>
          </Card>
        </section>
      </div>
    </>
  );
}

function Bullet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li>
      <span className="font-semibold text-foreground">{title}.</span>{' '}
      <span>{children}</span>
    </li>
  );
}