ALTER TABLE public.imaging_findings
ADD COLUMN IF NOT EXISTS ftd_review jsonb;

COMMENT ON COLUMN public.imaging_findings.ftd_review IS
'Failure-to-diagnose second-opinion AI review. NOT a medical diagnosis — screening aid only. Schema: { summary, possible_missed_findings: [{label, severity, detail, region, recommend_human_review}], confidence, disclaimer, reviewed_at, model }';