import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE_MODULE_COVERAGE_TARGETS = [
  ['modules', 'cards', 'snapshots.ts'],
  ['modules', 'chat', 'moderation.ts'],
  ['modules', 'circles', 'joinPolicy.ts'],
  ['modules', 'contacts', 'contactFields.ts'],
  ['modules', 'socialGraph', 'relationshipPolicy.ts'],
  ['modules', 'teamups', 'policy.ts'],
] as const;

test('core module coverage target imports every extracted core file', async () => {
  const srcDir = dirname(dirname(fileURLToPath(import.meta.url)));
  const imported = await Promise.all(CORE_MODULE_COVERAGE_TARGETS.map((segments) => (
    import(pathToFileURL(join(srcDir, ...segments)).href)
  )));

  assert.equal(imported.length, CORE_MODULE_COVERAGE_TARGETS.length);
});
