import test from 'node:test';
import assert from 'node:assert/strict';
import { hashStudentId, isValidStudentId, maskStudentId, normalizeStudentId } from './studentId.js';
import { canonicalStudentEmailFromId, canonicalStudentIdFromEmail, shouldAutoBindByEmail } from './studentIdPolicy.js';

test('isValidStudentId validates undergraduate and postgraduate ids', () => {
  assert.equal(isValidStudentId('221250001'), true);
  assert.equal(isValidStudentId('502024320001'), true);
  assert.equal(isValidStudentId('22125001'), false);
  assert.equal(isValidStudentId('2212500011'), false);
  assert.equal(isValidStudentId('50202432001'), false);
  assert.equal(isValidStudentId('5020243200011'), false);
  assert.equal(isValidStudentId('22125A001'), false);
  assert.equal(isValidStudentId(' 221250001 '), false);
});

test('normalizeStudentId trims whitespace', () => {
  assert.equal(normalizeStudentId(' 221250001 '), '221250001');
});

test('maskStudentId returns expected masked output', () => {
  assert.equal(maskStudentId('221250001'), '221****01');
  assert.equal(maskStudentId('502024320001'), '502****01');
  assert.equal(maskStudentId('invalid'), '***');
});

test('hashStudentId is stable and opaque', () => {
  const a = hashStudentId('221250001');
  const b = hashStudentId('221250001');
  const c = hashStudentId('221250002');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 64);
});

test('canonicalStudentIdFromEmail only accepts canonical local-part', () => {
  assert.equal(canonicalStudentIdFromEmail('221250001@smail.nju.edu.cn'), '221250001');
  assert.equal(canonicalStudentIdFromEmail('502024320001@smail.nju.edu.cn'), '502024320001');
  assert.equal(canonicalStudentIdFromEmail('nickname@smail.nju.edu.cn'), null);
  assert.equal(canonicalStudentIdFromEmail('221250001.alias@smail.nju.edu.cn'), null);
});

test('shouldAutoBindByEmail requires exact canonical match', () => {
  assert.equal(shouldAutoBindByEmail('221250001@smail.nju.edu.cn', '221250001'), true);
  assert.equal(shouldAutoBindByEmail('502024320001@smail.nju.edu.cn', '502024320001'), true);
  assert.equal(shouldAutoBindByEmail('221250001@smail.nju.edu.cn', '221250002'), false);
  assert.equal(shouldAutoBindByEmail('nickname@smail.nju.edu.cn', '221250001'), false);
});

test('canonicalStudentEmailFromId builds target bind mailbox', () => {
  assert.equal(canonicalStudentEmailFromId('221250001'), '221250001@smail.nju.edu.cn');
});
