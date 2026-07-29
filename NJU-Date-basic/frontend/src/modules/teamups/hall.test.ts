import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTeamupBadgeClass,
  getTeamupBadgeText,
  getTeamupTypeText,
  isJoinedTeamup,
} from './hall';

test('teamup hall policy formats type and viewer badges', () => {
  assert.equal(getTeamupTypeText({ teamupType: 'long_term' } as any), '长期组队');
  assert.equal(isJoinedTeamup({ viewer: { isTeamupMember: true } } as any), true);
  assert.equal(getTeamupBadgeText({ viewer: { isLeader: true } } as any), '我发起');
  assert.equal(getTeamupBadgeText({
    effectiveStatus: 'full',
    joinMode: 'direct',
    joinable: false,
    waitlistable: true,
  } as any), '可候补');
  assert.equal(getTeamupBadgeText({
    effectiveStatus: 'ended',
    joinMode: 'direct',
    joinable: false,
  } as any), '已结束');
  assert.equal(getTeamupBadgeClass({ viewer: { pendingApplicationId: 'app-1' } } as any), 'text-[#8B7355] border-[#8B7355]/30 bg-[#8B7355]/5');
});
