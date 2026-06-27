// Reviewer (mom) state — per-case. Stored in localStorage so no migration needed.
// Tracks decisions on AI findings + any bonus findings she adds herself.

import type { FindingCard, Bucket } from './patientSelfHelpTypes';

export type ReviewDecision = 'pending' | 'confirmed' | 'edited' | 'rejected';
export type BonusSeverity = 'low' | 'medium' | 'high';

export const BONUS_RATES: Record<BonusSeverity, number> = {
  low: 15,
  medium: 40,
  high: 100,
};

export const BONUS_RATE_LABELS: Record<BonusSeverity, string> = {
  low: 'Low priority  ·  $15',
  medium: 'Medium priority  ·  $40',
  high: 'High priority  ·  $100',
};

export type AIReview = {
  decision: ReviewDecision;
  note?: string;
  editedTitle?: string;
  editedWhyItMatters?: string;
  editedAskNext?: string;
  reviewedAt?: string;
};

export type BonusFinding = {
  id: string;
  title: string;
  severity: BonusSeverity;
  bucket: Bucket;
  notes: string;
  recordCitation?: string;
  createdAt: string;
};

export type ReviewerState = {
  reviewerName: string;
  startedAt?: string;
  finishedAt?: string;
  aiReviews: Record<string, AIReview>; // keyed by finding index "0","1",...
  bonusFindings: BonusFinding[];
};

const KEY = (caseId: string) => `psh-reviewer::${caseId}`;

export function loadReviewerState(caseId: string): ReviewerState {
  try {
    const raw = localStorage.getItem(KEY(caseId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { reviewerName: '', aiReviews: {}, bonusFindings: [] };
}

export function saveReviewerState(caseId: string, state: ReviewerState) {
  try { localStorage.setItem(KEY(caseId), JSON.stringify(state)); } catch { /* ignore */ }
}

export function computeBonus(state: ReviewerState): { total: number; counts: Record<BonusSeverity, number> } {
  const counts: Record<BonusSeverity, number> = { low: 0, medium: 0, high: 0 };
  for (const b of state.bonusFindings) counts[b.severity]++;
  const total = counts.low * BONUS_RATES.low + counts.medium * BONUS_RATES.medium + counts.high * BONUS_RATES.high;
  return { total, counts };
}

export function reviewProgress(state: ReviewerState, total: number) {
  const done = Object.values(state.aiReviews).filter(r => r.decision !== 'pending').length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function applyReviewToCards(
  cards: FindingCard[],
  state: ReviewerState,
): FindingCard[] {
  // Drop rejected, apply edits, then append bonus findings as cards
  const kept = cards
    .map((c, i) => ({ c, r: state.aiReviews[String(i)] }))
    .filter(({ r }) => r?.decision !== 'rejected')
    .map(({ c, r }) => {
      if (!r || r.decision === 'pending' || r.decision === 'confirmed') return c;
      return {
        ...c,
        title: r.editedTitle || c.title,
        whyItMatters: r.editedWhyItMatters || c.whyItMatters,
        askNext: r.editedAskNext || c.askNext,
      };
    });
  const bonus: FindingCard[] = state.bonusFindings.map(b => ({
    bucket: b.bucket,
    title: `[Reviewer add · ${b.severity}] ${b.title}`,
    whyItMatters: b.notes,
    whatRecordShows: b.recordCitation || '(reviewer-added — see notes)',
    whatItDoesNotProve: 'This is a reviewer observation flagged for follow-up. It does not by itself establish a standard-of-care breach.',
    askNext: '',
    severity: b.severity === 'high' ? 'high-documentation-issue' : b.severity === 'medium' ? 'moderate' : 'low',
  }));
  return [...kept, ...bonus];
}