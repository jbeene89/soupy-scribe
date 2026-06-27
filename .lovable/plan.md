## 90-Day Launch Plan — SoupyAudit private review company

**Wedge:** Florida malpractice plaintiff firms, sold a page-count-priced records reconciliation memo. SIU and patient-direct stay as funnels, not the lead.

**Team:** You (records analyst, software). Mom (RN + 35yr paralegal + insurance medical-claims specialist, co-founder, signs every memo at the upcharged tier).

**Goal:** 3 paid Florida law-firm clients in 90 days, signed BAA, E&O bound before the first paid memo.

---

## Pricing (revised to your page-count model)

Every order starts with an automatic page count on upload. The price tier locks the moment the count finishes. No surprises, no haggling.

| Tier | Page count | AI-only review | + Mom-signed memo | + Rush (72 hr) |
|---|---|---|---|---|
| Standard | Under 250 | $400 | $650 | +$200 |
| Complex | 250–750 | $750 | $1,150 | +$300 |
| Massive | 751–1,500 | $1,200 | $1,800 | +$500 |
| Mega | 1,501+ | $1,200 + $1/page over 1,000 | $1,800 + $1.50/page over 1,000 | +$750 |

**Every deliverable includes:**
- Findings PDF (the 6 buckets you already built)
- Records-to-Request checklist
- Timeline PDF
- 15-min handoff call

**Mom-signed adds:**
- Her credentials block on every page
- A signed cover letter ("Reviewed by [Mom], MSN, paralegal, 35 yrs medical claims")
- Inline nurse commentary on key findings
- 30-min handoff call instead of 15

**Rush** = guaranteed turnaround at the listed page tier. Standard turnaround is 5 business days; rush is 72 hrs (excluding weekends).

Pricing is on the public `/for-law-firms` page. Firms self-quote. No sales call needed for the first transaction.

---

## Why malpractice-pre-intake is the lead (not SIU, not patient-direct)

- **Repeat buyers.** Med-mal firms screen many more cases than they file. Your offer makes their paralegal cheaper.
- **No PHI-from-strangers risk.** The firm has signed patient authorization. You sign a BAA with the firm.
- **Mom's combo is the pitch.** RN + paralegal + insurance medical-claims = the exact reviewer profile firms already hire ad-hoc.
- **Short sales cycle.** SIU procurement takes 6–12 months. Firms can sign and pay in a week.

Patient-direct stays free at `/patient-self-help` and becomes a referral funnel: strong cases get a "Want a Florida firm to look at this?" button that hands off to your partner firms with the patient's consent.

SIU/3rd-party gets parked until month 4 when local-only is closer to ready.

---

## What gets built (4 phases over 90 days)

### Phase 1 — Legal & positioning (week 1–2, no code)
- Florida LLC + EIN.
- $1–3M E&O / professional liability policy quote (CM&F, Berxi).
- One-time attorney consult ($500–$1,000) to lock disclaimer language and confirm:
  - Mom signs as "RN, paralegal," never as expert witness.
  - You sign as "records analyst," never as auditor of care.
  - Every memo carries: *"This is a records reconciliation. It is not a legal opinion, a medical opinion, or a Florida statutory certificate of merit."*
- Sister DBA for the law-firm-facing brand (something cleaner than "SoupyAudit" for legal procurement). SoupyAudit stays the platform.

### Phase 2 — Productize the law-firm offer (week 2–4, code)

App changes I'll ship in one pass when you say go:

1. **New public page `/for-law-firms`** on soupyaudit.com. Hero, the 4-tier price grid above, mom's bio, your bio, disclaimer, "Request access" button. Matches existing dark design system.
2. **New "Firm portal" mode** added to the existing mode toggle (Payer / Provider / BH / Patient / **Firm**). Reuses the Patient Self-Help backend.
3. **Firm intake flow:** firm creates an account → signs a click-through BAA → opens a matter (firm name, matter #, patient initials) → uploads records → app auto-counts pages → tier and price lock in → firm picks AI-only vs Mom-signed and optional Rush → confirms → review starts.
4. **Auto page-counter on upload.** Runs before the analysis pipeline. Drives the price. Shown to the firm before they commit.
5. **"Mom-signed" workflow in admin:** new queue showing matters waiting for her review. She reads, edits, marks "signed." That flips the export PDFs to include her credentials block and signed cover letter.
6. **Rush flag** on the matter triggers a turnaround clock and surfaces the matter at the top of the queue.
7. **"Reviewed by" block + tier label** added to every existing export PDF.
8. **Public `/security` page** aimed at firm procurement: BAA available, audit log, role-based access, idle timeout, encrypted transport, roadmap to on-prem. Cleaned-up sibling of the internal `/hipaa-plan`.
9. **Lead-capture form** on `/for-law-firms` writes to a `firm_leads` table you can see in admin.

Payment collection in this phase = manual invoice (you send a PDF invoice; firm pays by check or ACH). Stripe integration is parked until you have 5+ paid matters, so you're not building checkout before product-market fit.

### Phase 3 — Soft launch + 3 design-partner firms (week 4–8)
- 30 small/mid Florida med-mal plaintiff firms on the outreach list. Mom's network first, cold second.
- Offer: 3 free Standard-tier AI-only screens to the first 10 firms that sign the BAA. Convert to paid on case #4.
- Every memo's downstream outcome tracked (opened / declined / settled). This becomes the validation bench for the business.

### Phase 4 — Funnel layers (week 8–12)
- Patient-direct adds the "Want a firm to look at this?" handoff button.
- One warm SIU intro through mom's insurance-side network. One pilot conversation, not a sales push.
- Begin on-prem Docker stack work for the eventual SIU/local-only upsell.

---

## Risks I'm flagging (not technical — these are the real ones)

- **Florida UPL/UPM line.** Memos must reconcile records, not opine on standard of care. Lock the disclaimer language with the attorney consult before the first paid memo.
- **Florida certificate of merit.** Florida requires a same-specialty expert affidavit. Be explicit with firms: you support that process, you do not satisfy it.
- **E&O bound before first paid client.** Non-negotiable.
- **Mom's throughput ceiling.** Roughly 40 mom-signed cases/month at sustainable pace. Build the "hire a second nurse-paralegal" trigger into the month-6 plan.
- **Page-count gaming.** Some firms will upload a slim subset to hit a lower tier. Mitigation: terms say "if delivered review reveals materially more records exist, tier may be re-priced."

---

## Decisions needed before I start building Phase 2

1. **Sister DBA name** for the law-firm-facing brand, or stick with SoupyAudit?
2. **Domain:** new `/for-law-firms` page on soupyaudit.com, or a second domain?
3. **Pricing approved as written above** (with mom-signed uplift and rush), or adjust any number?
4. **Mom-signed delivery time** — do we promise +2 business days on top of standard turnaround for the mom-signed tier, or hold the same turnaround?

Reply with answers to those four and I'll build Phase 2 in one pass.
