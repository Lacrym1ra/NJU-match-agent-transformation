import { api } from './client';

export interface ResonanceCapsule {
  id: string;
  title: string;
  prompt: string;
  status: 'awaiting_participant' | 'collecting' | 'revealed' | 'cancelled';
  role: 'creator' | 'participant';
  hasParticipant: boolean;
  isRevealed: boolean;
  myResponse: string | null;
  otherResponse: string | null;
  hasResponded: boolean;
  otherHasResponded: boolean;
  expiresAt: string;
  revealedAt: string | null;
  createdAt: string;
}

export const listResonanceCapsules = () =>
  api.get<{ capsules: ResonanceCapsule[] }>('/resonance');
export const getResonanceCapsule = (id: string) =>
  api.get<{ capsule: ResonanceCapsule }>(`/resonance/${id}`);
export const createResonanceCapsule = (input: {
  title: string; prompt: string; expiresInDays?: number;
}) => api.post<{ capsule: ResonanceCapsule; inviteCode: string }>('/resonance', input);
export const joinResonanceCapsule = (inviteCode: string) =>
  api.post<{ capsule: ResonanceCapsule }>('/resonance/join', { inviteCode });
export const respondToResonanceCapsule = (id: string, response: string) =>
  api.post<{ capsule: ResonanceCapsule }>(`/resonance/${id}/responses`, { response });
export const cancelResonanceCapsule = (id: string) =>
  api.post<{ capsule: ResonanceCapsule }>(`/resonance/${id}/cancel`, {});
