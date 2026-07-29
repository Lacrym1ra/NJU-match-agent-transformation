import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTeamupListQuery } from './queries';

test('teamup query policy builds list query strings', () => {
  assert.equal(buildTeamupListQuery(), '');
  assert.equal(buildTeamupListQuery('joined'), '?mine=joined');
  assert.equal(
    buildTeamupListQuery({ mine: 'created', teamupType: 'all', keyword: '  ' }),
    '?mine=created',
  );
  assert.equal(
    buildTeamupListQuery({ teamupType: 'short_term', keyword: '  摄影  ' }),
    '?teamupType=short_term&keyword=%E6%91%84%E5%BD%B1',
  );
});
