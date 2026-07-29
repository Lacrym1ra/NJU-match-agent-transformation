export {
  getContactUnlockRequests,
  getContactUnlockStatus,
  getFriendContactAvailabilityMap,
  getUnlockedContacts,
  handleContactUnlockRequest,
  revokeContactUnlockRequest,
  sendContactUnlockRequest,
  withdrawContactUnlockRequest,
} from './contactsService.js';
export type {
  ContactUnlockState,
  FriendContactAvailability,
} from './contactsService.js';
