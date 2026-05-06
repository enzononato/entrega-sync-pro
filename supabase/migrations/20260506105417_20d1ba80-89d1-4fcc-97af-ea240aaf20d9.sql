
-- Allow 'failed' status and add error_message column to track failed imports
ALTER TABLE public.import_batches
  DROP CONSTRAINT IF EXISTS import_batches_status_check;

ALTER TABLE public.import_batches
  ADD CONSTRAINT import_batches_status_check
  CHECK (status = ANY (ARRAY['preview'::text, 'confirmed'::text, 'undone'::text, 'failed'::text]));

ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS error_message text;
