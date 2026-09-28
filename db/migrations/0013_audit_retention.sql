-- 0013 — Conservazione del log di audit a 12 mesi (R-PRIV-03, docs/04 §8, WP-023b). Scritta a mano.
-- Il log resta append-only: nessuna modifica, mai; nessuna cancellazione delle righe recenti. Si possono
-- cancellare SOLO le righe con più di 12 mesi, che la regola di conservazione impone comunque di eliminare
-- (job `retention.audit`). Sostituisce l'idea del ruolo di manutenzione che disattiva il trigger (0002).
CREATE OR REPLACE FUNCTION audit_log_block_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.at < now() - interval '12 months' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_log è append-only: % non consentito', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
