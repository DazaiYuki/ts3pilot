export class NonceStore {
  private readonly seen = new Map<string, number>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs: number, maxEntries = 10000) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  checkAndStore(nonce: string, now = Date.now()): boolean {
    this.prune(now);
    if (this.seen.has(nonce)) return false;
    if (this.seen.size >= this.maxEntries) {
      const oldest = this.seen.keys().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    this.seen.set(nonce, now + this.ttlMs);
    return true;
  }

  private prune(now: number): void {
    for (const [nonce, expiry] of this.seen) {
      if (expiry <= now) this.seen.delete(nonce);
    }
  }
}
