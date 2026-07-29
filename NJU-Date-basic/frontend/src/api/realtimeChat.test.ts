import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRealtimeUrlFromBase } from './realtimeChat';

test('realtime chat url helper derives websocket endpoint without opening sockets', () => {
  assert.equal(
    buildRealtimeUrlFromBase('http://localhost:3000/api/v1', 'ticket a+b'),
    'ws://localhost:3000/api/v1/realtime?ticket=ticket%20a%2Bb',
  );
  assert.equal(
    buildRealtimeUrlFromBase('https://api.example.com/api/v1/', 't'),
    'wss://api.example.com/api/v1/realtime?ticket=t',
  );
});
