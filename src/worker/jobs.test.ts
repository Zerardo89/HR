import { describe, expect, it } from "vitest";
import { SCHEDULE_TZ, scheduledJobs } from "./jobs";

// WP-020: orari dei job pianificati.

describe("job pianificati", () => {
  it("nomi unici, ora italiana", () => {
    const names = scheduledJobs.map((j) => j.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(["maintenance.cleanup", "alerts.send"]));
    expect(SCHEDULE_TZ).toBe("Europe/Rome");
  });

  it("nessun job tra le 2 e le 3 di notte (l'ora che il cambio dell'ora salta o ripete)", () => {
    for (const job of scheduledJobs) {
      const [minute, hour] = job.cron.split(" ");
      expect(minute).toMatch(/^\d{1,2}$/);
      expect(hour).toMatch(/^\d{1,2}$/);
      expect(Number(hour)).not.toBe(2);
    }
  });
});
