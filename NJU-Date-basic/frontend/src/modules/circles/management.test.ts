import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCircleManageDate,
  getCircleApplicantName,
  getCircleJoinRequestText,
  getCirclePolicyMode,
} from './management';

test('circle management policy formats overview and request text', () => {
  assert.equal(getCirclePolicyMode('review' as any), 'review');
  assert.equal(formatCircleManageDate(null), '未记录');
  assert.equal(formatCircleManageDate('not-a-date'), '未记录');

  const request = {
    applicant: { nickname: '  小南  ' },
    applicationReason: '想加入',
    applicationAnswer: '',
    applicationAnswers: { q1: '答案一', q2: '答案二' },
  };

  assert.equal(getCircleApplicantName(request as any), '小南');
  assert.equal(getCircleJoinRequestText(request as any), '想加入\n\nq1: 答案一\nq2: 答案二');
  assert.equal(getCircleJoinRequestText({ ...request, applicationReason: '', applicationAnswers: null } as any), '对方没有留下额外说明');
});
