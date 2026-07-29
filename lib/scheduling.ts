/**
 * Spreads `count` articles evenly across Mon-Fri (weekday indices 1-5, where
 * 0=Sun..6=Sat, matching JS Date.getDay()). For count >= 5, fills every
 * weekday and then starts doubling up from Monday. This runs once whenever a
 * user changes their articles_per_week setting; the result is stored in
 * user_config.scheduled_weekdays so the daily cron can do a cheap lookup
 * instead of recomputing this every day.
 */
export function computeScheduledWeekdays(count: number): number[] {
  const weekdays = [1, 2, 3, 4, 5]; // Mon-Fri
  if (count <= 0) return [];
  if (count >= weekdays.length) return weekdays;

  const step = weekdays.length / count;
  const chosen: number[] = [];
  for (let i = 0; i < count; i++) {
    chosen.push(weekdays[Math.round(i * step)]);
  }
  return Array.from(new Set(chosen)).sort((a, b) => a - b);
}
