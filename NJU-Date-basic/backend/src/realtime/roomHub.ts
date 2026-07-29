import { WebSocket } from 'ws';
import type { ServerRealtimeEvent } from './types.js';

interface BroadcastOptions {
  except?: WebSocket;
  canReceive?: (userId: string) => boolean | Promise<boolean>;
  canReceiveMany?: (userIds: string[]) => Set<string> | Promise<Set<string>>;
}

class ChatHub {
  private rooms = new Map<string, Map<WebSocket, string>>();

  join(roomId: string, ws: WebSocket, userId: string) {
    const room = this.rooms.get(roomId) ?? new Map<WebSocket, string>();
    room.set(ws, userId);
    this.rooms.set(roomId, room);
  }

  has(roomId: string, ws: WebSocket) {
    return this.rooms.get(roomId)?.has(ws) ?? false;
  }

  getUserIds(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(new Set(Array.from(room.values())));
  }

  leave(roomId: string, ws: WebSocket) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.delete(ws);
    if (room.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  leaveAll(ws: WebSocket) {
    for (const roomId of this.rooms.keys()) {
      this.leave(roomId, ws);
    }
  }

  async broadcast(roomId: string, event: ServerRealtimeEvent, options: BroadcastOptions = {}) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const payload = JSON.stringify(event);
    const entries = Array.from(room.entries());
    const recipients: Array<[WebSocket, string]> = [];
    for (const [client, userId] of entries) {
      if (client.readyState !== WebSocket.OPEN) {
        this.leave(roomId, client);
        continue;
      }
      if (client === options.except) continue;
      recipients.push([client, userId]);
    }

    let allowedUserIds: Set<string> | null = null;
    if (options.canReceiveMany) {
      try {
        allowedUserIds = await options.canReceiveMany(Array.from(new Set(recipients.map(([, userId]) => userId))));
      } catch {
        allowedUserIds = new Set();
      }
    }

    for (const [client, userId] of recipients) {
      if (allowedUserIds && !allowedUserIds.has(userId)) {
        this.leave(roomId, client);
        continue;
      }
      if (options.canReceive) {
        let allowed = false;
        try {
          allowed = await options.canReceive(userId);
        } catch {
          allowed = false;
        }
        if (!allowed) {
          this.leave(roomId, client);
          continue;
        }
      }
      client.send(payload);
    }
  }
}

export const circleChatHub = new ChatHub();
export const teamupChatHub = new ChatHub();
