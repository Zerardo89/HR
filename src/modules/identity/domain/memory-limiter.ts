/**
 * Limite di frequenza a finestra scorrevole, tenuto solo in memoria (per gli IP: non si salvano nel DB).
 * Un solo processo serve l'app (ADR-0012), quindi la memoria del processo basta; al riavvio si azzera.
 */
export type LimitRule = { windowMs: number; max: number };

export class MemoryLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly rule: LimitRule,
    private readonly maxKeys = 10_000,
  ) {}

  /** Registra un tentativo; `false` se il limite è già stato raggiunto (il tentativo non viene contato). */
  hit(key: string, nowMs: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => nowMs - t < this.rule.windowMs);
    if (recent.length >= this.rule.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(nowMs);
    this.hits.delete(key); // reinserita in fondo: la Map resta in ordine di ultimo uso
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest !== undefined) this.hits.delete(oldest);
    }
    return true;
  }

  get size(): number {
    return this.hits.size;
  }
}
