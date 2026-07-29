import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, ValidationError } from './errors.js';
import {
  assertChatContentAllowed,
  normalizeChatContent,
  normalizeMentions,
} from '../modules/chat/moderation.js';

function assertAppError(
  action: () => unknown,
  expected: { statusCode: number; code: string; message?: string },
) {
  assert.throws(
    action,
    (err: unknown) => {
      assert.equal(err instanceof AppError, true);
      const appError = err as AppError;
      assert.equal(appError.statusCode, expected.statusCode);
      assert.equal(appError.code, expected.code);
      if (expected.message) assert.equal(appError.message, expected.message);
      return true;
    },
  );
}

test('normalizeChatContent rejects empty chat messages', () => {
  assertAppError(
    () => normalizeChatContent(' \r\n\t '),
    {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: '消息不能为空',
    },
  );
  assert.throws(() => normalizeChatContent('   '), ValidationError);
});

test('normalizeChatContent rejects overlong chat messages', () => {
  assert.equal(normalizeChatContent('a'.repeat(500)).length, 500);
  assertAppError(
    () => normalizeChatContent('a'.repeat(501)),
    {
      statusCode: 400,
      code: 'CHAT_MESSAGE_TOO_LONG',
      message: '消息不能超过 500 个字符',
    },
  );
});

test('assertChatContentAllowed blocks contact-like text', () => {
  for (const content of [
    '我的手机号是 13812345678',
    '邮箱 test@example.com',
    '微信: nju_date_2026',
  ]) {
    assertAppError(
      () => assertChatContentAllowed(content),
      {
        statusCode: 400,
        code: 'CONTACT_TEXT_NOT_ALLOWED',
      },
    );
  }
});

test('assertChatContentAllowed blocks circle keyword rules', () => {
  assert.doesNotThrow(() => assertChatContentAllowed('周末一起复习算法', [
    { keyword: '代写', action: 'reject' },
  ]));

  assertAppError(
    () => assertChatContentAllowed('有人接代写吗', [
      { keyword: '代写', action: 'reject' },
      { keyword: '刷分', action: 'reject' },
    ]),
    {
      statusCode: 400,
      code: 'KEYWORD_BLOCKED',
      message: '消息包含圈子规则限制的内容',
    },
  );
});

test('normalizeMentions trims, deduplicates, and filters empty mentions', () => {
  assert.deepEqual(
    normalizeMentions([' user-a ', 'user-b', '', 'user-a', ' \n ', 'user-c']),
    ['user-a', 'user-b', 'user-c'],
  );
  assert.deepEqual(normalizeMentions(undefined), []);
  assert.deepEqual(normalizeMentions(['user-a', 1, null, ' user-b '] as any), ['user-a', 'user-b']);
});

test('normalizeMentions rejects more than 20 unique mentions', () => {
  assert.equal(normalizeMentions(Array.from({ length: 20 }, (_, index) => `user-${index}`)).length, 20);
  assertAppError(
    () => normalizeMentions(Array.from({ length: 21 }, (_, index) => `user-${index}`)),
    {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: '一次最多提及 20 人',
    },
  );
});
