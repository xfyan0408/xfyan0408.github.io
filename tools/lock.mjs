import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL('../node_modules/staticrypt/cli/index.js', import.meta.url)),
  source,
  '--directory', fileURLToPath(new URL('private/', root)),
  '--template', fileURLToPath(new URL('password-template.html', import.meta.url)),
  '--remember', 'false',
  '--config', 'false',
], { stdio: 'inherit', cwd: fileURLToPath(root) });
if (result.error) { console.error(result.error.message); process.exit(1); }
if (result.status !== 0) process.exit(result.status ?? 1);
const output = await readFile(new URL('private/index.html', root), 'utf8');
if (!output.includes('encryptedMsg')) {
  console.error('Expected encrypted content was not generated. Do not publish.');
  process.exit(1);
}
console.log('Encrypted private/index.html is ready. Preview locally before publishing.');
