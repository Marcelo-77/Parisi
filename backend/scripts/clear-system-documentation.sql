-- Remove all rows from system_documentation (documents metadata).
-- Run on Neon/production when you need to clear uploaded document records.
-- Uploaded files on disk must be removed separately on the server (uploads/system-documentation/).

DELETE FROM system_documentation;
