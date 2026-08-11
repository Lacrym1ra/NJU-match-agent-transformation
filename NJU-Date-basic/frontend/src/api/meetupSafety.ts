import { api } from './client';

export type MeetupSafetyStatus = 'scheduled' | 'checked_in' | 'completed' | 'cancelled' | 'overdue';
export interface MeetupSafetyPlan {
  id: string;
  title: string;
  meetingPlace: string;
  meetingAt: string;
  expectedEndAt: string;
  note: string | null;
  status: MeetupSafetyStatus;
  checkedInAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const listMeetupSafetyPlans = () =>
  api.get<{ plans: MeetupSafetyPlan[] }>('/meetup-safety');
export const createMeetupSafetyPlan = (input: {
  title: string; meetingPlace: string; meetingAt: string; expectedEndAt: string; note?: string;
}) => api.post<{ plan: MeetupSafetyPlan }>('/meetup-safety', input);
export const transitionMeetupSafetyPlan = (
  id: string, transition: 'check_in' | 'complete' | 'cancel',
) => api.post<{ plan: MeetupSafetyPlan }>(`/meetup-safety/${id}/transitions`, { transition });
