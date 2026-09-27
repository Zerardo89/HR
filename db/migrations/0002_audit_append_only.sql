-- 0002 — Log di audit append-only (docs/04-PRIVACY-SICUREZZA.md §7).
-- Nessuno (nemmeno l'applicazione) può modificare o cancellare righe esistenti.
-- La conservazione a 12 mesi (R-PRIV-03) si farà con un ruolo dedicato di manutenzione
-- che disattiva il trigger in una transazione tracciata (WP-023).
CREATE OR REPLACE FUNCTION audit_log_block_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log è append-only: % non consentito', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_log_no_update_delete ON audit_log;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_changes();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_log_block_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log è append-only: TRUNCATE non consentito'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_truncate();
