-- Migration: Fix double-stringify bug on AI reference call columns.
--
-- Bug: api-server wrote `JSON.stringify([...])` into the JSONB columns
-- `_reference_check_responses.call_transcript` and `call_analysis`.
-- Postgres stored those values as JSON strings (jsonb_typeof = 'string')
-- containing a stringified array/object, instead of the array/object itself.
--
-- The frontend then tried to call `.map()` on the string (because the type
-- says `Array<...>`), throwing
--   "TypeError: callTranscript.map is not a function"
-- which unmounted the candidate detail page and produced a white screen
-- whenever the user navigated back to the Riwayat list.
--
-- This migration repairs existing rows by extracting the inner JSON from the
-- string wrapper. The api-server fix (remove JSON.stringify) prevents new
-- rows from getting into the same shape.

-- Repair call_transcript rows that were double-stringified.
UPDATE _reference_check_responses
SET call_transcript = (call_transcript #>> '{}')::jsonb
WHERE call_transcript IS NOT NULL
  AND jsonb_typeof(call_transcript) = 'string';

-- Repair call_analysis rows that were double-stringified.
UPDATE _reference_check_responses
SET call_analysis = (call_analysis #>> '{}')::jsonb
WHERE call_analysis IS NOT NULL
  AND jsonb_typeof(call_analysis) = 'string';

NOTIFY pgrst, 'reload schema';
