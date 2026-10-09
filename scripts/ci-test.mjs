// Preserve normal test output and expose failures through GitHub annotations.
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
let output = '';
const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
  shell: process.platform === 'win32',
  stdio: ['inherit', 'pipe', 'pipe'],
});
for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
  stream.on('data', chunk => { destination.write(chunk); output += chunk.toString(); });
}
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('close', code => {
  if (code !== 0) {
    const failureSection = output.lastIndexOf('✖ failing tests:');
    const details = failureSection >= 0 ? output.slice(failureSection) : output.slice(-20000);
    for (let offset = 0; offset < details.length; offset += 3500) {
      console.log(`::error::${details.slice(offset, offset + 3500).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
    }
    process.exitCode = code ?? 1;
  }
});
