BEGIN;
CREATE INDEX transactions_import_source_row ON cgt.transactions (import_id, source_record);
COMMIT;
