import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SEO } from '@/components/SEO';

export default function MethodologyAuditingTheAuditor() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Auditing the Auditor: Attacking RAC Extrapolation Math"
        description="A procedural and statistical methodology for contesting RAC extrapolated overpayment demands under CMS MPIM Chapter 8."
        path="/methodology/auditing-the-auditor"
      />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Link>
        </Button>

        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
          Auditing the Auditor
        </h1>
        <p className="text-muted-foreground mb-8">
          A methodology note on contesting RAC extrapolation under CMS MPIM Chapter 8.
        </p>

        <div className="prose prose-invert max-w-none space-y-6 text-[15px] leading-relaxed">
          <p>
            Recovery auditors routinely convert a sample of 30–50 claims into a six- or seven-figure
            overpayment demand. The math that gets them there is rarely audited by the provider on
            the receiving end. It should be. CMS Medicare Program Integrity Manual (MPIM) Chapter 8
            sets out specific procedural requirements for sampling and extrapolation, and a single
            high-severity procedural defect is enough to void the extrapolation entirely — leaving
            only the actual sampled overpayments in play.
          </p>

          <h2 className="text-xl font-semibold mt-8">The four places extrapolations break</h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              <strong>Universe definition.</strong> MPIM 8.4.2 requires a clearly defined sampling
              frame. Demands that pull from a universe that includes ineligible claim types, wrong
              date ranges, or duplicate claim lines are vulnerable on the frame alone.
            </li>
            <li>
              <strong>Sample size justification.</strong> Chapter 8 does not mandate a minimum
              sample size, but it does require the chosen size to be defensible against the target
              precision. Demands that skip the precision calculation, or rely on RAT-STATS defaults
              without documenting the seed and parameters, are challengeable.
            </li>
            <li>
              <strong>Stratification executed as declared.</strong> Stratified designs must be
              executed exactly as documented. A common defect is declaring stratification by dollar
              band and then drawing the sample as a simple random sample — or stratifying but
              failing to weight the point estimate by stratum size.
            </li>
            <li>
              <strong>RAT-STATS seed and reproducibility.</strong> The seed, version, and parameters
              must be preserved so the sample can be reproduced. Missing seed documentation is a
              high-severity procedural defect on its own.
            </li>
          </ol>

          <h2 className="text-xl font-semibold mt-8">Recomputing the floor</h2>
          <p>
            Even when the procedural challenge does not fully void the extrapolation, the
            arithmetic itself is contestable. CMS guidance and ALJ practice favor the one-sided 90%
            lower confidence bound as the defensible point of demand when an extrapolation
            survives. The recipe is mechanical:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>For each sampled claim, recompute the per-claim overpayment after the provider's
            actual defense outcome (full defense, partial, conceded).</li>
            <li>Compute the sample mean overpayment and standard deviation from those revised
            per-claim values.</li>
            <li>Compute the standard error and the t-critical value at df = n − 1 for a one-sided
            90% confidence interval.</li>
            <li>Lower bound on the population mean = sample mean − (t × SE).</li>
            <li>Defensible floor = lower bound × N (universe size).</li>
          </ul>
          <p>
            The gap between the auditor's original demand and that floor is the real settlement
            conversation. It is also the number that should drive whether to appeal at the QIC
            level or hold for ALJ.
          </p>

          <h2 className="text-xl font-semibold mt-8">Why this matters more than pre-submission cleanup</h2>
          <p>
            Pre-submission claim hygiene reduces the rate at which clean claims get denied. It does
            nothing about claims that have already been paid and are being clawed back two years
            later through extrapolation. Those two problems live in different parts of the revenue
            cycle, and they require different defenses. Treating extrapolation defense as a
            separate discipline — procedural attack first, statistical recomputation second — is
            what changes the economics.
          </p>

          <Card className="p-5 mt-10 bg-muted/30">
            <p className="text-sm text-muted-foreground mb-2">Implementation</p>
            <p className="text-sm">
              SOUPY Audit operationalizes this methodology in a dedicated module that ingests a
              claims roster, scores each claim's defense strength, runs the MPIM Chapter 8
              compliance check, and recomputes both the point estimate and the 90% lower confidence
              bound from actual defense outcomes. The output is a settlement-leverage packet, not a
              talking point.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}