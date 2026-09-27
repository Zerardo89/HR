import type { Pool } from "pg";

/**
 * Telefono e codici di recupero persi (WP-011b): un admin, dopo aver verificato chi chiede, azzera la 2FA
 * con `pnpm mfa:reset`. Si cancellano segreto, codici di recupero, biglietti e sessioni aperte: al prossimo
 * accesso l'utente riattiva la 2FA dal codice email. Riga di audit senza dati personali.
 * Ritorna `false` se l'utente non esiste.
 */
export async function resetSecondFactor(pool: Pool, userId: string, now: Date): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rowCount } = await client.query(`select 1 from users where id = $1 for update`, [
      userId,
    ]);
    if (!rowCount) {
      await client.query("rollback");
      return false;
    }
    await client.query(`delete from auth_totp where user_id = $1`, [userId]);
    await client.query(`delete from auth_recovery_codes where user_id = $1`, [userId]);
    await client.query(`delete from auth_mfa_tickets where user_id = $1`, [userId]);
    await client.query(`delete from auth_sessions where user_id = $1`, [userId]);
    await client.query(
      `insert into audit_log (actor_id, action, target_table, target_id, at)
       values ('system:mfa-reset', 'auth.mfa_reset', 'users', $1, $2)`,
      [userId, now],
    );
    await client.query("commit");
    return true;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
