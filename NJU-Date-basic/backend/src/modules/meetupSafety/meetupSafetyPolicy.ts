export type StoredMeetupStatus = 'scheduled' | 'checked_in' | 'completed' | 'cancelled';
export type MeetupViewStatus = StoredMeetupStatus | 'overdue';
export type MeetupTransition = 'check_in' | 'complete' | 'cancel';

export function validateMeetupWindow(meetingAt: string, expectedEndAt: string, now = Date.now()) {
  const start = Date.parse(meetingAt);
  const end = Date.parse(expectedEndAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('时间格式无效');
  if (start <= now) throw new Error('见面时间必须晚于当前时间');
  if (end <= start) throw new Error('预计结束时间必须晚于见面时间');
  if (end - start > 24 * 60 * 60_000) throw new Error('单次安心赴约计划不能超过 24 小时');
  return {
    meetingAt: new Date(start).toISOString(),
    expectedEndAt: new Date(end).toISOString(),
  };
}

export function deriveMeetupStatus(
  status: StoredMeetupStatus,
  expectedEndAt: string,
  now = Date.now(),
): MeetupViewStatus {
  if (status === 'scheduled' && Date.parse(expectedEndAt) < now) return 'overdue';
  return status;
}

export function assertMeetupTransition(status: StoredMeetupStatus, transition: MeetupTransition) {
  const allowed: Record<StoredMeetupStatus, MeetupTransition[]> = {
    scheduled: ['check_in', 'cancel'],
    checked_in: ['complete', 'cancel'],
    completed: [],
    cancelled: [],
  };
  if (!allowed[status].includes(transition)) {
    throw new Error(`不能从 ${status} 执行 ${transition}`);
  }
}
