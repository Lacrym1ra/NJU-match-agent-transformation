import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { circleChatHub } from './roomHub.js';

type FakeSocket = {
  readyState: number;
  sent: string[];
  send: (payload: string) => void;
};

function createSocket(readyState: number = WebSocket.OPEN): FakeSocket {
  const socket: FakeSocket = {
    readyState,
    sent: [],
    send(payload: string) {
      this.sent.push(payload);
    },
  };
  return socket;
}

function asWebSocket(socket: FakeSocket) {
  return socket as unknown as WebSocket;
}

test('ChatHub supports join and leave', () => {
  const roomId = 'roomhub-join-leave';
  const socketA = createSocket();
  const socketB = createSocket();

  circleChatHub.join(roomId, asWebSocket(socketA), 'user-a');
  circleChatHub.join(roomId, asWebSocket(socketB), 'user-a');
  assert.equal(circleChatHub.has(roomId, asWebSocket(socketA)), true);
  assert.equal(circleChatHub.has(roomId, asWebSocket(socketB)), true);
  assert.deepEqual(circleChatHub.getUserIds(roomId), ['user-a']);

  circleChatHub.leave(roomId, asWebSocket(socketA));
  assert.equal(circleChatHub.has(roomId, asWebSocket(socketA)), false);
  assert.equal(circleChatHub.has(roomId, asWebSocket(socketB)), true);

  circleChatHub.leave(roomId, asWebSocket(socketB));
  assert.deepEqual(circleChatHub.getUserIds(roomId), []);
});

test('ChatHub leaveAll removes a socket from every room', () => {
  const roomA = 'roomhub-leave-all-a';
  const roomB = 'roomhub-leave-all-b';
  const sharedSocket = createSocket();
  const otherSocket = createSocket();

  circleChatHub.join(roomA, asWebSocket(sharedSocket), 'user-a');
  circleChatHub.join(roomB, asWebSocket(sharedSocket), 'user-a');
  circleChatHub.join(roomB, asWebSocket(otherSocket), 'user-b');

  circleChatHub.leaveAll(asWebSocket(sharedSocket));

  assert.equal(circleChatHub.has(roomA, asWebSocket(sharedSocket)), false);
  assert.equal(circleChatHub.has(roomB, asWebSocket(sharedSocket)), false);
  assert.equal(circleChatHub.has(roomB, asWebSocket(otherSocket)), true);
  circleChatHub.leave(roomB, asWebSocket(otherSocket));
});

test('ChatHub broadcast only sends to allowed open recipients', async () => {
  const roomId = 'roomhub-broadcast-allowed';
  const allowedSocket = createSocket();
  const blockedSocket = createSocket();
  const closedSocket = createSocket(WebSocket.CLOSED);
  const senderSocket = createSocket();

  circleChatHub.join(roomId, asWebSocket(allowedSocket), 'user-allowed');
  circleChatHub.join(roomId, asWebSocket(blockedSocket), 'user-blocked');
  circleChatHub.join(roomId, asWebSocket(closedSocket), 'user-closed');
  circleChatHub.join(roomId, asWebSocket(senderSocket), 'user-sender');

  await circleChatHub.broadcast(roomId, { type: 'pong', ts: 100 }, {
    except: asWebSocket(senderSocket),
    canReceiveMany: (userIds) => {
      assert.deepEqual(new Set(userIds), new Set(['user-allowed', 'user-blocked']));
      return new Set(['user-allowed']);
    },
  });

  assert.deepEqual(allowedSocket.sent, [JSON.stringify({ type: 'pong', ts: 100 })]);
  assert.deepEqual(blockedSocket.sent, []);
  assert.deepEqual(closedSocket.sent, []);
  assert.deepEqual(senderSocket.sent, []);
  assert.equal(circleChatHub.has(roomId, asWebSocket(allowedSocket)), true);
  assert.equal(circleChatHub.has(roomId, asWebSocket(blockedSocket)), false);
  assert.equal(circleChatHub.has(roomId, asWebSocket(closedSocket)), false);
  assert.equal(circleChatHub.has(roomId, asWebSocket(senderSocket)), true);

  circleChatHub.leave(roomId, asWebSocket(allowedSocket));
  circleChatHub.leave(roomId, asWebSocket(senderSocket));
});
