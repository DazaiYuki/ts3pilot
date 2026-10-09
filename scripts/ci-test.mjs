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
    const lines = output.split('\n');
    const indices = lines.flatMap((line, index) => /not ok|✖|AssertionError|Error:|FAIL/.test(line) ? [index] : []);
    const details = indices.length ? indices.map(index => lines.slice(Math.max(0, index - 2), index + 35).join('\n')).join('\n') : output.slice(-20000);
    console.log(`::error::${details.slice(0, 40000).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
    process.exitCode = code ?? 1;
  }
});
