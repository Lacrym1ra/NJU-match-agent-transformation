import type { ChatMessageDto } from '../modules/chat/circleChat.js';

export type ClientRealtimeEvent =
  | {
      type: 'chat.join';
      roomType: 'circle';
      circleId: string;
    }
  | {
      type: 'chat.join';
      roomType: 'teamup';
      circleId: string;
      teamupId: string;
    }
  | {
      type: 'chat.send';
      clientMessageId: string;
      roomType: 'circle';
      circleId: string;
      content: string;
      mentions?: string[];
    }
  | {
      type: 'chat.send';
      clientMessageId: string;
      roomType: 'teamup';
      circleId: string;
      teamupId: string;
      content: string;
      mentions?: string[];
    }
  | {
      type: 'chat.typing';
      roomType: 'circle';
      circleId: string;
      isTyping: boolean;
    }
  | {
      type: 'chat.typing';
      roomType: 'teamup';
      circleId: string;
      teamupId: string;
      isTyping: boolean;
    }
  | {
      type: 'ping';
      ts: number;
    };

export type ServerRealtimeEvent =
  | { type: 'chat.ready'; roomType: 'circle'; circleId: string }
  | { type: 'chat.ready'; roomType: 'teamup'; circleId: string; teamupId: string }
  | { type: 'chat.ack'; clientMessageId: string; message: ChatMessageDto }
  | { type: 'chat.message'; message: ChatMessageDto }
  | { type: 'chat.deleted'; messageId: string; roomType: 'circle'; circleId: string }
  | { type: 'chat.deleted'; messageId: string; roomType: 'teamup'; circleId: string; teamupId: string }
  | { type: 'chat.typing'; userId: string; nickname: string | null; isTyping: boolean; circleId: string; teamupId?: string }
  | { type: 'chat.error'; code: string; message: string; clientMessageId?: string }
  | { type: 'pong'; ts: number };
