import { Link } from 'react-router-dom';
import { ArrowLeft, Server } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SubProcessor {
  name: string;
  purpose: string;
  data: string;
  region: string;
  baa: 'yes' | 'na';
}

const ROWS: SubProcessor[] = [
  { name: 'Lovable Cloud (Supabase)', purpose: 'Application hosting, Postgres database, file storage, edge compute', data: 'All application data including encrypted PHI when applicable', region: 'US', baa: 'yes' },
  { name: 'Google (Gemini API)',      purpose: 'LLM inference for clinical/coding analysis perspectives',           data: 'De-identified clinical text per request; not retained for training', region: 'US', baa: 'yes' },
  { name: 'OpenAI (GPT API)',         purpose: 'LLM inference for adversarial / consensus perspectives',            data: 'De-identified clinical text per request; not retained for training', region: 'US', baa: 'yes' },
  { name: 'Resend',                   purpose: 'Transactional email (account, audit notifications)',                data: 'Email address, account metadata. No PHI.',                          region: 'US', baa: 'na' },
  { name: 'Cloudflare',               purpose: 'DNS, CDN, DDoS protection',                                         data: 'Request metadata only. No PHI in transit content.',                 region: 'Global edge', baa: 'na' },
];

export default function SubProcessors() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/30 backdrop-blur">
        <div className="container max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/trust" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Trust Center
          </Link>
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Sub-processors</span>
          </div>
        </div>
      </header>

      <section className="container max-w-5xl mx-auto px-6 py-16">
        <div className="max-w-3xl mb-10">
          <Badge variant="outline" className="mb-4 font-mono text-[10px] uppercase tracking-wider">Updated {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Badge>
          <h1 className="text-4xl font-semibold tracking-tight mb-4">Sub-processors</h1>
          <p className="text-muted-foreground leading-relaxed">
            The third parties SOUPY engages to deliver the service. We notify customers under signed agreement
            of any material additions at least 30 days before they take effect.
          </p>
        </div>

        <Card className="bg-card/40 border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr className="text-left">
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Sub-processor</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Purpose</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Data processed</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Region</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">BAA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {ROWS.map((r) => (
                  <tr key={r.name} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-4 font-medium align-top">{r.name}</td>
                    <td className="px-4 py-4 text-muted-foreground align-top">{r.purpose}</td>
                    <td className="px-4 py-4 text-muted-foreground align-top">{r.data}</td>
                    <td className="px-4 py-4 text-muted-foreground align-top whitespace-nowrap">{r.region}</td>
                    <td className="px-4 py-4 align-top">
                      <Badge variant="outline" className={r.baa === 'yes' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-muted text-muted-foreground border-border'}>
                        {r.baa === 'yes' ? 'Signed' : 'N/A'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-10">
          Subscribe to sub-processor change notifications:{' '}
          <a href="mailto:trust@soupyaudit.com?subject=Subscribe%20to%20sub-processor%20updates" className="underline hover:text-foreground">trust@soupyaudit.com</a>
        </p>
      </section>
    </div>
  );
}