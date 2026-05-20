import { Mail, Sparkles, FileSearch, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CONTACT_EMAIL = 'j.beene89@gmail.com';

const SHADOW_SUBJECT = 'Shadow Audit Request — SOUPY';
const SHADOW_BODY =
  'Hi Justin,%0D%0A%0D%0AI%27d like to run a shadow audit against a sample of our claims.%0D%0A%0D%0A' +
  '- Organization:%0D%0A- Role:%0D%0A- Volume / specialty:%0D%0A- Primary pain point (denials, undercoding, audit defense, other):%0D%0A%0D%0AThanks.';

const VARIANT_SUBJECT = 'Custom Variant Request — SOUPY';
const VARIANT_BODY =
  'Hi Justin,%0D%0A%0D%0AI%27m interested in a customized variant of the SOUPY engine.%0D%0A%0D%0A' +
  '- Use case / vertical:%0D%0A- What the standard modes don%27t cover:%0D%0A- Integration constraints (EHR, clearinghouse, on-prem, etc.):%0D%0A- Rough timeline:%0D%0A%0D%0AThanks.';

interface Props {
  variant?: 'dark' | 'card';
  className?: string;
}

export function ShadowAuditInvite({ variant = 'card', className }: Props) {
  const isDark = variant === 'dark';

  return (
    <section
      className={cn(
        'relative rounded-2xl border overflow-hidden p-6 md:p-8',
        isDark
          ? 'border-[hsl(220,40%,35%)] bg-gradient-to-br from-[hsl(220,30%,12%)] to-[hsl(220,25%,18%)]'
          : 'border-border bg-card shadow-sm',
        className,
      )}
    >
      <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Work directly with the builder
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
            Want a shadow audit or a custom variant?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Send a small batch of claims for a confidential shadow audit, or describe a workflow this engine
            doesn&apos;t fully cover yet — I build customized variants for specific specialties, payer mixes, and
            integration constraints.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/60 bg-background/40 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Shadow Audit</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed flex-1">
              Run de-identified claims through SOUPY in parallel with your current process. You see what it
              would have flagged, recovered, or prevented — no integration, no commitment.
            </p>
            <Button asChild size="sm" className="w-full">
              <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(SHADOW_SUBJECT)}&body=${SHADOW_BODY}`}>
                <Mail className="h-3.5 w-3.5" />
                Email about a shadow audit
              </a>
            </Button>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/40 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Custom Variant</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed flex-1">
              Need a tailored build — different specialty, different payer logic, different evidence rules, or a
              white-labeled deployment? Describe the use case and I&apos;ll scope it.
            </p>
            <Button asChild size="sm" variant="outline" className="w-full">
              <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(VARIANT_SUBJECT)}&body=${VARIANT_BODY}`}>
                <Mail className="h-3.5 w-3.5" />
                Request a custom variant
              </a>
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/70">
          Or just write directly:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline-offset-2 hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </section>
  );
}