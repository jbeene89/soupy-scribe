import { Link } from 'react-router-dom';
import { ArrowLeft, FileCheck, Stamp, Clock, ShieldCheck, Scale, Mail, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SEO } from '@/components/SEO';

/**
 * Public marketing + self-quote page for Florida malpractice plaintiff firms.
 * Functional CTAs only: mailto link, scroll-to-pricing, and a real handoff
 * email. No fake forms. Pricing is page-count driven so firms can self-quote.
 */

const CONTACT_EMAIL = 'firms@soupyaudit.com';
const SUBJECT = 'Records review request';
const BODY = `Firm name:%0D%0AContact:%0D%0AMatter / patient initials:%0D%0AEstimated page count:%0D%0ATier interested in (Standard / Complex / Massive / Mega):%0D%0AAI-only or Mom-signed:%0D%0ARush (72hr)? Y / N:%0D%0AAnything else:`;
const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${BODY}`;

type Tier = {
  name: string;
  pages: string;
  ai: string;
  signed: string;
  rush: string;
  highlight?: boolean;
};

const TIERS: Tier[] = [
  { name: 'Standard', pages: 'Under 250 pages', ai: '$400', signed: '$650', rush: '+$200' },
  { name: 'Complex', pages: '250 – 750 pages', ai: '$750', signed: '$1,150', rush: '+$300', highlight: true },
  { name: 'Massive', pages: '751 – 1,500 pages', ai: '$1,200', signed: '$1,800', rush: '+$500' },
  { name: 'Mega', pages: '1,501+ pages', ai: '$1,200 + $1 / page over 1,000', signed: '$1,800 + $1.50 / page over 1,000', rush: '+$750' },
];

export default function LawFirms() {
  return (
    <>
      <SEO
        title="Records review for Florida malpractice firms — SOUPY Audit"
        description="Fixed-fee, page-count-priced medical records reconciliation memos for Florida malpractice plaintiff firms. Optional nurse-paralegal signed review. BAA available."
        path="/for-law-firms"
      />
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card/30 backdrop-blur">
          <div className="container max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              SOUPY Audit
            </Link>
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">For Law Firms</span>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="container max-w-5xl mx-auto px-6 py-16 space-y-6">
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">Florida · Plaintiff med-mal</Badge>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
            Pre-intake records reconciliation,<br />priced by the page.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            A fixed-fee written memo your intake paralegal can act on. We reconcile what the chart says
            against what it does <em>not</em> show, surface contradictions, and hand back a Records-to-Request
            checklist. Optional nurse-paralegal signed review for cases you're seriously considering.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg">
              <a href={MAILTO}>
                <Mail className="h-4 w-4 mr-2" />
                Request a review
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="#pricing">See pricing</a>
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <Link to="/procurement">Security & BAA</Link>
            </Button>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 pt-8">
            <Feature icon={FileCheck} title="Self-quote at upload">
              Page count is detected on upload. Your tier and price lock in before you commit.
            </Feature>
            <Feature icon={Stamp} title="Optional nurse-paralegal sign-off">
              Reviewed and signed by an RN with 35 years of medical-claims and paralegal experience.
            </Feature>
            <Feature icon={Clock} title="5 business days, or 72-hour rush">
              Rush surfaces your matter to the top of the queue.
            </Feature>
          </div>
        </section>

        {/* What you get */}
        <section className="border-t border-border bg-card/20">
          <div className="container max-w-5xl mx-auto px-6 py-16 space-y-8">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">What every memo includes</h2>
              <p className="text-sm text-muted-foreground mt-1">Delivered as PDFs your intake team can paste into a matter file.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-6 bg-card/40 border-border space-y-3">
                <h3 className="font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Findings memo</h3>
                <p className="text-sm text-muted-foreground">Organized into six buckets: Looks Routine, Needs Clarification, Record Mismatch, Consent Flag, Missing Source Document, Ask For This Next. Every finding cites the record page it came from.</p>
              </Card>
              <Card className="p-6 bg-card/40 border-border space-y-3">
                <h3 className="font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Records-to-Request checklist</h3>
                <p className="text-sm text-muted-foreground">Specific named documents missing from what you sent, ranked by how much they would change the picture. Printable and check-off-able.</p>
              </Card>
              <Card className="p-6 bg-card/40 border-border space-y-3">
                <h3 className="font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Timeline PDF</h3>
                <p className="text-sm text-muted-foreground">A chronological event list pulled from the chart with timestamps and page references — ready to drop into a chronology spreadsheet.</p>
              </Card>
              <Card className="p-6 bg-card/40 border-border space-y-3">
                <h3 className="font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> 15-minute handoff call</h3>
                <p className="text-sm text-muted-foreground">Walk through the memo with the reviewer. 30 minutes on Mom-signed tier.</p>
              </Card>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="container max-w-5xl mx-auto px-6 py-16 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Pricing</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload the chart. The system counts pages and locks in the tier before you confirm. No call required.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIERS.map((t) => (
              <Card
                key={t.name}
                className={`p-6 space-y-3 border-border bg-card/40 ${t.highlight ? 'ring-1 ring-primary/40' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{t.name}</h3>
                  {t.highlight && <Badge variant="outline" className="text-[10px] font-mono">Most common</Badge>}
                </div>
                <p className="text-xs font-mono text-muted-foreground">{t.pages}</p>
                <div className="pt-2 border-t border-border space-y-2 text-sm">
                  <Row label="AI-only">{t.ai}</Row>
                  <Row label="Mom-signed" emphasis>{t.signed}</Row>
                  <Row label="Rush (72hr)" muted>{t.rush}</Row>
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-6 bg-card/40 border-border text-sm text-muted-foreground space-y-2">
            <p>
              <strong className="text-foreground">AI-only</strong> = software-generated reconciliation memo with citations to the record.
              <strong className="text-foreground"> Mom-signed</strong> = the same memo, reviewed line by line by an RN + paralegal with 35 years of medical-claims experience, signed and credentialed on every page.
              <strong className="text-foreground"> Rush</strong> = guaranteed 72-hour turnaround (excluding weekends) on top of the listed tier.
            </p>
            <p>
              Standard turnaround is 5 business days. If the delivered chart turns out to be a partial subset
              and additional records change the tier, the matter may be re-priced at the actual page count.
            </p>
          </Card>
        </section>

        {/* Disclaimer */}
        <section className="border-t border-border bg-card/20">
          <div className="container max-w-5xl mx-auto px-6 py-12">
            <Card className="p-6 bg-card/40 border-amber-500/20">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-500/80 mb-3">What this is, and what it isn't</h2>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
                <li>A records <strong className="text-foreground">reconciliation</strong> — what the chart says, what it does not show, and what to ask for next.</li>
                <li><strong className="text-foreground">Not</strong> a legal opinion.</li>
                <li><strong className="text-foreground">Not</strong> a medical opinion or standard-of-care critique.</li>
                <li><strong className="text-foreground">Not</strong> a Florida § 766.203 corroborating expert affidavit. We support that process; we do not satisfy it.</li>
              </ul>
            </Card>
          </div>
        </section>

        {/* Trust + CTA */}
        <section className="container max-w-5xl mx-auto px-6 py-16 space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="p-5 bg-card/40 border-border space-y-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-sm">BAA on signup</h3>
              <p className="text-xs text-muted-foreground">Click-through Business Associate Agreement before any chart is uploaded.</p>
            </Card>
            <Card className="p-5 bg-card/40 border-border space-y-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-sm">Full access log</h3>
              <p className="text-xs text-muted-foreground">Every read, export, and AI run is logged for the HIPAA 6-year retention window.</p>
            </Card>
            <Card className="p-5 bg-card/40 border-border space-y-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-sm">On-prem on the roadmap</h3>
              <p className="text-xs text-muted-foreground">A self-hosted deployment so no chart leaves your office. See the procurement page.</p>
            </Card>
          </div>

          <Card className="p-8 bg-gradient-to-br from-primary/10 to-card/40 border-primary/20 text-center space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">Ready to send a chart?</h2>
            <p className="text-sm text-muted-foreground">Email the matter details. We respond within one business day with a secure upload link and the BAA.</p>
            <Button asChild size="lg">
              <a href={MAILTO}>
                <Mail className="h-4 w-4 mr-2" />
                Email {CONTACT_EMAIL}
              </a>
            </Button>
          </Card>
        </section>

        <footer className="border-t border-border">
          <div className="container max-w-5xl mx-auto px-6 py-8 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
            <span>© {new Date().getFullYear()} SOUPY Audit. Florida.</span>
            <div className="flex gap-4">
              <Link to="/procurement" className="hover:text-foreground">Security & BAA</Link>
              <Link to="/security" className="hover:text-foreground">Vulnerability disclosure</Link>
              <Link to="/trust" className="hover:text-foreground">Trust center</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

function Feature({ icon: Icon, title, children }: { icon: typeof FileCheck; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 bg-card/40 border-border space-y-2">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
    </Card>
  );
}

function Row({ label, children, emphasis, muted }: { label: string; children: React.ReactNode; emphasis?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={`text-xs ${muted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`font-mono ${emphasis ? 'text-foreground font-semibold' : muted ? 'text-muted-foreground' : 'text-foreground'}`}>
        {children}
      </span>
    </div>
  );
}