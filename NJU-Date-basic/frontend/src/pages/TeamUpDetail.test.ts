import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAMUP_TYPE_TEXT, canReportTeamupMember, displayInitial, displayName } from './TeamUpDetail';

test('TeamUpDetail helpers format member names and type text in place', () => {
  assert.equal(displayName('  小南  '), '小南');
  assert.equal(displayName('   ', '无名氏'), '无名氏');
  assert.equal(displayInitial('  小南  '), '小');
  assert.equal(displayInitial(null, 'NJU'), 'N');
  assert.equal(TEAMUP_TYPE_TEXT.short_term, '临期组队');
  assert.equal(TEAMUP_TYPE_TEXT.long_term, '长期组队');
});

test('TeamUpDetail helper only allows reporting other members after teamup ended', () => {
  assert.equal(canReportTeamupMember('ended', 'viewer-1', 'member-2'), true);
  assert.equal(canReportTeamupMember('expired', 'viewer-1', 'member-2'), false);
  assert.equal(canReportTeamupMember('cancelled', 'viewer-1', 'member-2'), false);
  assert.equal(canReportTeamupMember('ended', 'viewer-1', 'viewer-1'), false);
  assert.equal(canReportTeamupMember('ended', null, 'member-2'), false);
});
