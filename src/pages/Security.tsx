import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Bug, Mail } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Security() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/30 backdrop-blur">
        <div className="container max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/trust" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Trust Center
          </Link>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Vulnerability Disclosure</span>
          </div>
        </div>
      </header>

      <section className="container max-w-4xl mx-auto px-6 py-16 space-y-8">
        <div>
          <Badge variant="outline" className="mb-4 font-mono text-[10px] uppercase tracking-wider">Effective {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Badge>
          <h1 className="text-4xl font-semibold tracking-tight mb-4">Coordinated vulnerability disclosure</h1>
          <p className="text-muted-foreground leading-relaxed">
            We welcome reports from security researchers. This page outlines the rules of engagement, what is in scope,
            and how we'll work with you.
          </p>
        </div>

        <Card className="p-6 bg-card/40 border-border">
          <div className="flex items-start gap-3 mb-4">
            <Mail className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold">Report channel</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Email <a href="mailto:security@soupyaudit.com" className="underline hover:text-foreground">security@soupyaudit.com</a> with reproduction steps,
                impact, and any supporting artifacts. PGP key available on request.
              </p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-mono space-y-1 pl-8">
            <div>Acknowledgement SLA · within 2 business days</div>
            <div>Triage SLA · within 5 business days</div>
            <div>Fix targets · Critical 7d · High 30d · Medium 90d</div>
          </div>
        </Card>

        <Card className="p-6 bg-card/40 border-border">
          <h2 className="text-lg font-semibold mb-3">In scope</h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
            <li><code className="text-foreground">soupyaudit.com</code> and all subdomains</li>
            <li>Authentication, authorization, and tenant isolation</li>
            <li>FHIR ingestion pipeline and document storage</li>
            <li>Server-side prompt injection or data exfiltration via the audit engine</li>
            <li>Insecure direct object references in case / org access</li>
          </ul>
        </Card>

        <Card className="p-6 bg-card/40 border-border">
          <h2 className="text-lg font-semibold mb-3">Out of scope</h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
            <li>Denial of service or volumetric testing</li>
            <li>Social engineering of staff or customers</li>
            <li>Physical attacks against offices, equipment, or personnel</li>
            <li>Findings from automated scanners without working proof of concept</li>
            <li>Best-practice deltas with no demonstrated security impact</li>
            <li>Vulnerabilities in third-party services not under our control</li>
          </ul>
        </Card>

        <Card className="p-6 bg-card/40 border-border">
          <div className="flex items-start gap-3 mb-3">
            <Bug className="h-5 w-5 text-primary mt-0.5" />
            <h2 className="text-lg font-semibold">Safe harbor</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Good-faith research conducted under this policy is authorized. We will not pursue legal action against
            researchers who: (1) avoid privacy violations and service disruption, (2) use only test accounts they own
            or that we provide, (3) give us a reasonable window to remediate before public disclosure, and (4) do not
            access, modify, or retain data beyond what is necessary to demonstrate the vulnerability.
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-primary/10 to-card/40 border-primary/20">
          <h2 className="text-lg font-semibold mb-2">Recognition</h2>
          <p className="text-sm text-muted-foreground">
            We don't currently run a paid bug bounty, but valid reports earn public credit (with your permission)
            and a hall-of-fame listing on this page once the disclosure window closes.
          </p>
        </Card>
      </section>
    </div>
  );
}