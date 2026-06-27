import { Link } from 'react-router-dom';
import { ArrowLeft, Receipt, Mail, ShieldCheck, AlertTriangle, CheckCircle2, DollarSign, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SEO } from '@/components/SEO';

/**
 * Public marketing page for patient-facing medical bill review.
 * "Does this hospital bill look right?" — a plain-English wedge for the
 * same underlying engine that powers our records review.
 */

const CONTACT_EMAIL = 'bills@soupyaudit.com';
const SUBJECT = 'Medical bill review request';
const BODY = `Your name:%0D%0AHospital / provider:%0D%0ADate(s) of service:%0D%0ATotal billed amount:%0D%0AInsurance involved? (Y/N + carrier):%0D%0ANumber of bills / pages:%0D%0AWhat feels wrong:`;
const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${BODY}`;

type Tier = {
  name: string;
  scope: string;
  price: string;
  includes: string[];
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    name: 'Quick Check',
    scope: 'One bill, under 25 line items',
    price: '$49',
    includes: [
      'Line-by-line CPT / HCPCS sanity check',
      'Duplicate-charge scan',
      'Plain-English summary of what looks off',
    ],
  },
  {
    name: 'Standard Review',
    scope: 'Full hospital stay or ER visit',
    price: '$149',
    highlight: true,
    includes: [
      'Itemized bill vs. EOB reconciliation',
      'Upcoding, unbundling, and phantom-charge scan',
      'Written dispute letter you can send to billing',
      '15-min handoff call',
    ],
  },
  {
    name: 'Complex Review',
    scope: 'Long stay, multiple providers, or surgery + facility',
    price: '$299',
    includes: [
      'Everything in Standard',
      'Multi-provider cross-reference (hospital, surgeon, anesthesia, pathology)',
      'Out-of-network and balance-billing flags',
      'Optional escalation packet for state insurance commissioner',
    ],
  },
  {
    name: 'Contingency',
    scope: 'You only pay if we find real savings',
    price: '25% of corrections',
    includes: [
      'No upfront fee',
      'We work the dispute end-to-end',
      'You pay 25% of whatever we get knocked off the bill',
      'Subject to a brief upfront screen to confirm the bill has fixable errors',
    ],
  },
];

const RED_FLAGS = [
  'Charges for a private room when you were in a shared one',
  'Two charges for the same procedure on the same day',
  '"Operating room time" billed in larger blocks than you were actually in surgery',
  'Lab panels billed individually instead of bundled',
  'A surgeon and an "assistant surgeon" both billing full fees',
  'Out-of-network anesthesia or pathology on an in-network hospital stay',
  'EOB says insurance paid, but the hospital is still billing you the same amount',
];

export default function BillIntegrity() {
  return (
    <>
      <SEO
        title="Medical bill review — does this hospital bill look right? | SOUPY Audit"
        description="Flat-fee medical bill review for patients and families. We line-check hospital and ER bills for upcoding, duplicates, and balance-billing errors. From $49."
        path="/bill-integrity"
      />
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card/30 backdrop-blur">
          <div className="container max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              SOUPY Audit
            </Link>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Bill Integrity</span>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="container max-w-5xl mx-auto px-6 py-16 space-y-6">
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">For patients & families</Badge>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
            Does this hospital bill<br />actually look right?
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Roughly 4 out of 5 itemized hospital bills contain at least one billing error. We line-check
            yours against the codes, your insurance EOB, and what actually happened — then hand you back a
            plain-English summary and a dispute letter you can send.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg">
              <a href={MAILTO}>
                <Mail className="h-4 w-4 mr-2" />
                Send us your bill
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="#pricing">See pricing</a>
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <Link to="/patient-self-help">Free self-help tool</Link>
            </Button>
          </div>
        </section>

        {/* What we look for */}
        <section className="container max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight">What we look for</h2>
          </div>
          <Card className="p-6">
            <ul className="space-y-3">
              {RED_FLAGS.map((flag) => (
                <li key={flag} className="flex items-start gap-3 text-sm leading-relaxed">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Pricing */}
        <section id="pricing" className="container max-w-5xl mx-auto px-6 py-12 space-y-6">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight">Flat pricing. No surprise fees.</h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Pick the tier that matches your situation. If you're not sure, send us your bill and we'll quote
            you back — most people land on Standard.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {TIERS.map((tier) => (
              <Card key={tier.name} className={`p-6 ${tier.highlight ? 'border-primary' : ''}`}>
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="font-semibold text-lg">{tier.name}</h3>
                  {tier.highlight && <Badge variant="default" className="text-[10px]">Most common</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{tier.scope}</p>
                <p className="text-3xl font-semibold tracking-tight mb-4">{tier.price}</p>
                <ul className="space-y-2">
                  {tier.includes.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>

        {/* Trust / disclaimer */}
        <section className="container max-w-5xl mx-auto px-6 py-12">
          <Card className="p-6 bg-card/50">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                <p className="text-foreground font-medium">What this is, and what it isn't.</p>
                <p>
                  This is a billing reconciliation. We compare what was billed to what your insurance was
                  shown, the standard coding rules, and what your records say happened. It is not legal
                  advice, it is not a medical opinion, and it does not replace your insurance appeal process.
                </p>
                <p>
                  Every review is handled under standard HIPAA safeguards. We sign a BAA on request. See
                  our <Link to="/procurement" className="underline">security & procurement page</Link>.
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* CTA */}
        <section className="container max-w-5xl mx-auto px-6 py-16 text-center space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Ready to find out?</h2>
          <p className="text-sm text-muted-foreground">Email us your bill (PDF or photos). We'll come back with a quote and a turnaround.</p>
          <Button asChild size="lg">
            <a href={MAILTO}>
              <Mail className="h-4 w-4 mr-2" />
              {CONTACT_EMAIL}
            </a>
          </Button>
        </section>
      </div>
    </>
  );
}