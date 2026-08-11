import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { loadSecret } from './secretSource.js';

const secretRoot = mkdtempSync(path.join(tmpdir(), 'nju-match-secret-'));
after(() => rmSync(secretRoot, { recursive: true, force: true }));

describe('loadSecret', () => {
  it('loads a trimmed secret from an allowlisted credential file', () => {
    const secretPath = path.join(secretRoot, 'llm_api_key');
    writeFileSync(secretPath, 'server-only-key\n', { mode: 0o600 });

    const value = loadSecret('LLM_API_KEY', {
      env: { LLM_API_KEY_FILE: secretPath },
      allowedRoots: [secretRoot],
    });

    assert.equal(value, 'server-only-key');
  });

  it('ignores an unavailable optional allowlist root when another root contains the secret', () => {
    const secretPath = path.join(secretRoot, 'llm_api_key_with_missing_root');
    const missingRoot = path.join(secretRoot, 'missing-optional-root');
    writeFileSync(secretPath, 'server-only-key\n', { mode: 0o600 });

    const value = loadSecret('LLM_API_KEY', {
      env: { LLM_API_KEY_FILE: secretPath },
      allowedRoots: [secretRoot, missingRoot],
    });

    assert.equal(value, 'server-only-key');
  });

  it('keeps an environment value as a development compatibility source', () => {
    assert.equal(loadSecret('LLM_API_KEY', {
      env: { LLM_API_KEY: 'development-key' },
      allowedRoots: [secretRoot],
    }), 'development-key');
  });

  it('rejects ambiguous inline and file sources', () => {
    assert.throws(() => loadSecret('LLM_API_KEY', {
      env: { LLM_API_KEY: 'inline', LLM_API_KEY_FILE: path.join(secretRoot, 'key') },
      allowedRoots: [secretRoot],
    }), /must not both be set/);
  });

  it('rejects credential files outside allowlisted runtime directories', () => {
    assert.throws(() => loadSecret('LLM_API_KEY', {
      env: { LLM_API_KEY_FILE: path.resolve('package.json') },
      allowedRoots: [secretRoot],
    }), /approved runtime secret directory/);
  });

  it('does not include secret content when an invalid file is rejected', () => {
    const secretPath = path.join(secretRoot, 'empty');
    writeFileSync(secretPath, '   \n', { mode: 0o600 });
    assert.throws(() => loadSecret('LLM_API_KEY', {
      env: { LLM_API_KEY_FILE: secretPath },
      allowedRoots: [secretRoot],
    }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message.includes('server-only-key'), false);
      return /must not be empty/.test(error.message);
    });
  });
});
