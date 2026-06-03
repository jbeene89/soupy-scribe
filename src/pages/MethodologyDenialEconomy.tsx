import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SEO } from '@/components/SEO';

export default function MethodologyDenialEconomy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="The Denial Economy Is Asymmetric — And That's the Opening"
        description="An op-ed on RAC extrapolation, surgical capacity loss, and why the asymmetry between payers and providers is contestable."
        path="/methodology/denial-economy"
      />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Link>
        </Button>

        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Op-Ed</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
          The Denial Economy Is Asymmetric — And That's the Opening
        </h1>
        <p className="text-muted-foreground mb-8">
          On RAC extrapolation, surgical capacity, and the math nobody on the provider side is doing.
        </p>

        <div className="prose prose-invert max-w-none space-y-5 text-[15px] leading-relaxed">
          <p>
            Talk to anyone who has spent a year inside a hospital revenue cycle and you hear the
            same sentence in different words: the people sending the denials have more time, more
            tooling, and more patience than the people answering them. That is not a complaint.
            It is the business model. The denial economy is asymmetric by design, and pretending
            otherwise is what keeps providers losing slow.
          </p>

          <p>
            The numbers behind it are not small. The CMS{' '}
            <a
              href="https://www.cms.gov/newsroom/fact-sheets/fiscal-year-2023-improper-payments-fact-sheet"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              FY2023 Improper Payments Fact Sheet
            </a>{' '}
            puts the Medicare fee-for-service improper payment rate at 7.38%, or roughly $31
            billion — the pool that Recovery Audit Contractor extrapolations are built on top of.
            A RAC reviews thirty or fifty claims, finds error rates inside that sample, and
            multiplies the result across a universe of thousands. A six-figure sample becomes a
            seven-figure demand. The provider gets a letter. The clock starts.
          </p>

          <p>
            What almost never happens next is the part that matters. Almost no one on the provider
            side audits the auditor's math. CMS Medicare Program Integrity Manual Chapter 8 is
            explicit about what a defensible extrapolation has to contain — a clearly defined
            universe, a documented sample-size justification, stratification executed exactly as
            declared, and a RAT-STATS seed preserved so the sample can be reproduced. Miss any
            one of those, and the extrapolation is challengeable on procedure alone. Survive the
            procedure, and the arithmetic is still contestable: the defensible point of demand is
            the one-sided 90% lower confidence bound recomputed from the provider's actual defense
            outcomes, not the auditor's opening number. The gap between those two figures is where
            the settlement actually lives. We wrote up the mechanics in a separate note —{' '}
            <Link to="/methodology/auditing-the-auditor" className="text-primary underline underline-offset-4">
              Auditing the Auditor
            </Link>
            {' '}— for anyone who wants the recipe.
          </p>

          <p>
            The same asymmetry shows up upstream, in places nobody calls a denial. A surgeon
            blocks an OR for Tuesday morning. The patient's prior authorization is still pending
            Monday at five. The block goes unfilled, the patient gets rescheduled, the peer-to-peer
            never quite gets onto a calendar, and three weeks later the case is either done at a
            competitor or not done at all. No claim was denied. No letter was sent. Capacity just
            quietly evaporated. Multiply that across a service line and you have the real story of
            why surgical throughput numbers look the way they do — not because the OR was idle, but
            because the readiness work that protects the block never happened on time.
          </p>

          <p>
            Both problems share a shape. One side is running a continuous, instrumented process.
            The other side is reacting, case by case, under time pressure, with people whose
            primary job is something else. The fix is not more effort on the reactive side. The
            fix is to put the same kind of continuous, instrumented process on the provider side
            of the line — pre-op readiness that flags the auth risk before the block is held,
            vendor watch that tracks which payers and which auditors are running which plays this
            quarter, capacity balance that surfaces the OR minutes leaking out the back, and a
            clawback defense that treats every extrapolated demand as a math problem first and a
            legal problem second.
          </p>

          <p>
            None of that is a moral argument. It is an operational one. The denial economy is not
            going to get more symmetric on its own. The opening is to stop treating each letter
            and each rescheduled case as a one-off, and start treating the whole thing as what it
            already is on the other side of the table: a pipeline with measurable inputs, a
            measurable conversion rate, and a number at the end that responds to attention.
          </p>

          <Card className="p-5 mt-10 bg-muted/30">
            <p className="text-sm text-muted-foreground mb-2">Further reading</p>
            <p className="text-sm">
              <Link to="/methodology/auditing-the-auditor" className="text-primary underline underline-offset-4">
                Auditing the Auditor
              </Link>
              {' '}— the procedural and statistical recipe for contesting a RAC extrapolation
              under MPIM Chapter 8.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}