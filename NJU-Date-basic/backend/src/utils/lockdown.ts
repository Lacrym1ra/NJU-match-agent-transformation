/**
 * Matching lockdown window: Wednesday 18:00 ~ 20:00 (Beijing Time).
 * During this period, survey submissions and participation status changes are blocked
 * to prevent data changes while the matching algorithm is running.
 */
export function isMatchingLocked(): boolean {
  // Get current Beijing time (UTC+8)
  const now = new Date();
  const beijingMs = now.getTime() + 8 * 60 * 60 * 1000;
  const beijing = new Date(beijingMs);

  const day = beijing.getUTCDay(); // 0=Sun, 3=Wed
  const hour = beijing.getUTCHours();

  // Locked only during Wednesday 18:00 ~ 19:59 (matching computation → reveal)
  return day === 3 && hour >= 18 && hour < 20;
}
