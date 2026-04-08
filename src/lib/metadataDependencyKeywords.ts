/**
 * Canonical Metadata Dependency Keywords
 *
 * Single source of truth for metadata-dependent keyword detection.
 * Used by:
 *   - src/lib/caseGovernance.ts (client-side severity classification)
 *   - supabase/functions/analyze-case/index.ts (edge function scoring)
 *
 * ⚠ If you update this list, you MUST also update the METADATA_KEYWORDS
 *   constant in supabase/functions/analyze-case/index.ts — edge functions
 *   cannot import from src/.
 *
 * Last synced: 2026-04-08
 */

export const METADATA_DEPENDENT_KEYWORDS = [
  // Entity / billing identity
  'separate tin',
  'separate billing entity',
  'billing entity',
  'separate npi',
  'separate provider',

  // Clinical documentation
  'missing mar',
  'medication administration record',
  'missing consultant note',
  'consultant note',
  'consult note',
  'missing operative note',
  'operative note',
  'op note',
  'time log',
  'time documentation',
  'anesthesia record',

  // Authorization & device
  'prior authorization',
  'implant manifest',
  'implant log',
  'device log',

  // Lab / pathology
  'pathology report',
  'lab results',

  // Modifier
  'modifier documentation',

  // Medical necessity
  'medical necessity documentation',

  // Payer
  'payer policy',
  'payer-specific',
] as const;

export type MetadataDependencyKeyword = typeof METADATA_DEPENDENT_KEYWORDS[number];
