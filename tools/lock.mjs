import { access, readFile, writeFile, mkdir, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);
// The editable plaintext is a sibling of the public Git repository, not a published file.
const source = fileURLToPath(new URL('../../xfyan0408-private/index.html', import.meta.url));
try {
  await access(source);
} catch {
  console.error(`Private draft not found: ${source}`);
  console.error('Keep your private HTML outside the public repository. See README.md.');
  process.exit(1);
}
// Build in a fresh directory so a cancelled password prompt cannot reuse stale output.
const staging = await mkdtemp(join(tmpdir(), 'nanaki-encrypted-'));
try {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('../node_modules/staticrypt/cli/index.js', import.meta.url)),
    source,
    '--directory', staging,
    '--template', fileURLToPath(new URL('password-template.html', import.meta.url)),
    '--remember', 'false',
    '--config', 'false',
    ...(process.argv.includes('--short') ? ['--short'] : []),
  ], { stdio: 'inherit', cwd: fileURLToPath(root) });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Encryption exited with code ${result.status}`);
  const output = await readFile(join(staging, 'index.html'), 'utf8');
  const payload = output.match(/\/\/ private-payload:start\s*([\s\S]*?)\s*\/\/ private-payload:end/)?.[1];
  if (!payload || !payload.includes('staticryptEncryptedMsgUniqueVariableName') || output.includes('/*[|')) {
    throw new Error('Expected encrypted content was not generated. Do not publish.');
  }
  await mkdir(new URL('private/', root), { recursive: true });
  await writeFile(new URL('private/payload.js', root), `${payload}\n`);
  await writeFile(new URL('private/index.html', root), output);
  console.log('Encrypted page and dialog payload are ready. Preview locally before publishing.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await unlink(join(staging, 'index.html')).catch(() => {});
  await rmdir(staging);
}
