// Opt-in real TS3/WordPress verification. Test credentials never reach stdout.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { defaultConfig } from '../apps/ts3-manager/src/domain/schemas.ts';

if (!process.argv.includes('--accept-eula')) throw new Error('Read the official TeamSpeak license and explicitly pass --accept-eula');
const root = resolve(new URL('..', import.meta.url).pathname);
const suffix = `${process.pid}-${Date.now()}`;
const network = `ts3pilot-integration-${suffix}`;
const ts3Name = `${network}-ts3`, wpName = `${network}-wp`, dbName = `${network}-db`;
const volume = `${network}-wp-data`;
const work = join(root, 'tmp', network);
const binary = join(root, 'apps/ts3-manager/dist/pkg/ts3pilot-linux-x64');
const version = JSON.parse(readFileSync(join(root, 'package.json'))).version;
const archive = join(root, 'dist/release', `ts3pilot-wp-v${version}.zip`);
mkdirSync(work, { recursive: true, mode: 0o700 });
const containers = [];
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
const dockerLogs = name => {
  const result = spawnSync('docker', ['logs', name], { encoding: 'utf8', timeout: 30000 });
  if (result.status !== 0) throw new Error('Unable to read isolated server logs');
  return result.stdout + result.stderr;
};
const pause = () => new Promise(resolvePromise => setTimeout(resolvePromise, 1000));
const wait = async (check, label) => {
  for (let i = 0; i < 90; i++) { if (await check()) return; await pause(); }
  throw new Error(`Timed out: ${label}`);
};
const launch = (name, args) => { containers.push(name); docker('run', '-d', '--name', name, ...args); };
const wpEnv = ['-e', `WORDPRESS_DB_HOST=${dbName}`, '-e', 'WORDPRESS_DB_NAME=wordpress', '-e', 'WORDPRESS_DB_USER=wordpress', '-e', `WORDPRESS_DB_PASSWORD=${randomBytes(24).toString('hex')}`];
const dbPassword = wpEnv[7].slice('WORDPRESS_DB_PASSWORD='.length);
const wp = (...args) => docker('run', '--rm', '--user=0', '--network', `container:${wpName}`, '-v', `${volume}:/var/www/html`, '-v', `${work}:/state:ro`, '-v', `${root}/sandbox:/checks:ro`, '-v', `${root}/dist/release:/artifacts:ro`, ...wpEnv, 'wordpress:cli', 'wp', '--allow-root', ...args);
const privateWrite = (path, content) => writeFileSync(path, content, { mode: 0o600 });
const getQueryPassword = logs => {
  const password = logs.match(/password=\s*"([^"]+)"/)?.[1];
  if (!password) throw new Error('Generated ServerQuery credential was not found');
  return password;
};
try {
  docker('network', 'create', network);
  docker('volume', 'create', volume);
  for (const image of ['teamspeak:3.13.7', 'wordpress:cli', 'wordpress:php8.3-apache', 'mariadb:11.4', 'ubuntu:24.04']) docker('pull', image);
  launch(ts3Name, ['--network', network, '-e', 'TS3SERVER_LICENSE=accept', 'teamspeak:3.13.7']);
  launch(dbName, ['--network', network, '-e', 'MARIADB_RANDOM_ROOT_PASSWORD=1', '-e', 'MARIADB_DATABASE=wordpress', '-e', 'MARIADB_USER=wordpress', '-e', `MARIADB_PASSWORD=${dbPassword}`, 'mariadb:11.4']);
  launch(wpName, ['--network', network, '-v', `${volume}:/var/www/html`, ...wpEnv, 'wordpress:php8.3-apache']);
  await wait(() => {
    try { wp('db', 'check'); return true; } catch { return false; }
  }, 'WordPress database');
  wp('core', 'install', '--url=http://localhost', '--title=TS3Pilot-integration', '--admin_user=integration-admin', `--admin_password=${randomBytes(24).toString('hex')}`, '--admin_email=test@example.invalid', '--skip-email');
  wp('plugin', 'install', `/artifacts/${archive.split('/').pop()}`, '--activate');
  console.log(`PASS released WordPress ZIP activation (WordPress ${wp('core', 'version').trim()})`);
  await wait(() => dockerLogs(ts3Name).includes('listening for query'), 'official TS3 Query');

  const exerciseAgent = async (serverName, password, port, installPath = '') => {
    const cfg = defaultConfig();
    cfg.mode = 'production'; cfg.dataDir = '/state';
    cfg.ts3.query.host = serverName; cfg.ts3.query.username = 'serveradmin'; cfg.ts3.query.password = password;
    cfg.ts3.deployment.kind = 'remote'; cfg.agent.port = port;
    if (installPath) cfg.ts3.installPath = installPath;
    const path = join(work, `agent-${port}.json`);
    privateWrite(path, JSON.stringify(cfg));
    const output = execFileSync(binary, ['api', 'enable', '--config', path, '--port', String(port)], { encoding: 'utf8' });
    privateWrite(join(work, 'pairing.txt'), output);
    const agentName = `${network}-agent-${port}`;
    launch(agentName, ['--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`, '--network', `container:${wpName}`, '-v', `${binary}:/ts3pilot:ro`, '-v', `${work}:/state`, '--entrypoint', '/ts3pilot', 'teamspeak:3.13.7', 'agent', '--config', `/state/agent-${port}.json`]);
    await wait(() => {
      try { return wp('eval', `echo wp_remote_retrieve_response_code(wp_remote_get('http://127.0.0.1:${port}/v1/health'));`).trim() === '200'; } catch { return false; }
    }, 'loopback Agent health');
    const result = wp('eval-file', '/checks/wp-smoke.php', `http://127.0.0.1:${port}`);
    assert.ok(result.includes('PASS WordPress anonymous authorization denied'), result);
    console.log(result.trim());
  };
  const wpIP = docker('inspect', wpName, '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}').trim();
  assert.match(wpIP, /^[0-9.]+$/);
  docker('exec', ts3Name, 'sh', '-c', 'printf "%s/32\\n" "$1" >> /var/ts3server/query_ip_allowlist.txt', 'sh', wpIP);
  await exerciseAgent(ts3Name, getQueryPassword(dockerLogs(ts3Name)), 17880);
  console.log('PASS existing official TS3 instance managed through WordPress');

  // Download through the official HTTPS origin, with normal certificate trust.
  // In a restricted cloud environment this target must be allowed explicitly.
  const tsArchive = join(work, 'server.tar.bz2');
  const officialURL = 'https://files.teamspeak-services.com/releases/server/3.13.7/teamspeak3-server_linux_amd64-3.13.7.tar.bz2';
  execFileSync('curl', ['-fsSL', '--max-time', '180', officialURL, '-o', tsArchive], { stdio: 'pipe', timeout: 190000 });
  const digest = createHash('sha256').update(readFileSync(tsArchive)).digest('hex');
  const nativeName = `${network}-native`;
  const native = join(work, 'native'); mkdirSync(native);
  // The official start script daemonizes. Init must reap orphaned children so
  // its stop command does not wait forever on a zombie in this test container.
  launch(nativeName, ['--init', '--network', network, '-v', `${binary}:/ts3pilot:ro`, '-v', `${native}:/native`, 'ubuntu:24.04', '/bin/sh', '-ec', 'apt-get update >/native/apt.log 2>&1 && DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl bzip2 libstdc++6 >/native/packages.log 2>&1 && touch /native/prerequisites.ok && exec sleep infinity']);
  await wait(() => { try { docker('exec', nativeName, 'test', '-f', '/native/prerequisites.ok'); return true; } catch { return false; } }, 'native Ubuntu prerequisites');
  docker('exec', nativeName, '/ts3pilot', 'config', 'init', '--config', '/native/config.json');
  docker('exec', nativeName, '/ts3pilot', 'config', 'set', 'mode', 'production', '--config', '/native/config.json');
  docker('exec', nativeName, '/ts3pilot', 'install', '--accept-eula', '--version', '3.13.7', '--install-path', '/native/ts3', '--expected-sha256', digest, '--config', '/native/config.json');
  const installed = JSON.parse(docker('exec', nativeName, 'cat', '/native/config.json'));
  assert.equal(installed.ts3.installPath, '/native/ts3');
  docker('exec', nativeName, 'sh', '-c', 'printf "%s/32\\n" "$1" >> /native/ts3/query_ip_allowlist.txt', 'sh', wpIP);
  docker('exec', nativeName, 'sh', '-ec', 'useradd --system --user-group --shell /usr/sbin/nologin ts3; chmod 755 /native; chown -R ts3:ts3 /native/ts3; cd /native/ts3; runuser -u ts3 -- ./ts3server_startscript.sh start > /native/server.log 2>&1');
  await wait(() => {
    try {
      return docker('exec', nativeName, 'sh', '-ec', 'find /native/ts3/logs -type f -name "*.log" -exec grep -l "listening for query" {} +').trim().length > 0;
    } catch { return false; }
  }, 'new native Ubuntu TS3');
  const nativePassword = getQueryPassword(docker('exec', nativeName, 'cat', '/native/server.log'));
  await exerciseAgent(nativeName, nativePassword, 17881);
  console.log('PASS new native Ubuntu TS3 installation managed through WordPress');

  // Stop only our test server, then prove adopt does not alter its files.
  docker('exec', nativeName, 'sh', '-ec', 'cd /native/ts3; runuser -u ts3 -- ./ts3server_startscript.sh stop');
  const fingerprint = () => docker('exec', nativeName, 'sh', '-ec', 'find /native/ts3 -type f -exec sha256sum {} + | sort');
  const before = fingerprint();
  const analysis = docker('exec', nativeName, '/ts3pilot', 'adopt', '--config', '/native/config.json');
  assert.ok(analysis.includes('deployment: native'), analysis);
  assert.equal(fingerprint(), before);
  console.log('PASS native adopt is read-only');
  const versions = Object.fromEntries(['teamspeak:3.13.7', 'wordpress:php8.3-apache', 'wordpress:cli', 'mariadb:11.4', 'ubuntu:24.04'].map(image => [image, docker('image', 'inspect', image, '--format', '{{index .RepoDigests 0}}').trim()]));
  writeFileSync(join(root, 'dist/release/integration-results.json'), JSON.stringify({ version, testedAt: new Date().toISOString(), passed: true, images: versions }, null, 2) + '\n');
  console.log('integration: ALL GREEN');
} catch (error) {
  // Do not print child-process arguments/output: they can contain test secrets.
  const reason = error.status === undefined && !error.cmd ? error.message : error.code ?? error.name;
  console.error(`integration failed: ${reason}; test state: ${work}`);
  process.exitCode = 1;
} finally {
  for (const name of containers.reverse()) { try { docker('rm', '-f', name); } catch { /* only our test resources */ } }
  try { docker('volume', 'rm', volume); } catch { /* only our test volume */ }
  try { docker('network', 'rm', network); } catch { /* only our test network */ }
}
