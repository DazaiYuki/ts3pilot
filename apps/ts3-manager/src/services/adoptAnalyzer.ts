import { join } from 'node:path';
import type { AppConfig } from '../domain/schemas.ts';

export interface AdoptFinding {
  kind: 'info' | 'warn' | 'error';
  message: string;
}

export interface PortProbe {
  port: number;
  name: string;
  open: boolean;
}

export interface AdoptAnalysis {
  installPath: string;
  found: string[];
  missing: string[];
  ini: Record<string, string>;
  ports: PortProbe[];
  findings: AdoptFinding[];
  recommendations: string[];
}

export interface AdoptDependencies {
  config: AppConfig;
  fileExists(path: string): boolean;
  readFile(path: string): string | undefined;
  probePort(host: string, port: number): Promise<boolean>;
}

const DETECTABLE_FILES = [
  'ts3server',
  'ts3server_linux_amd64',
  'ts3server_startscript.sh',
  'ts3server.sqlitedb',
  'ts3server.ini',
  'files',
  'logs',
  'licensekey.dat',
  '.ts3server.license',
];

const INI_KEYS = ['query_port', 'query_ip_whitelist', 'filetransfer_port', 'voice_port', 'query_ssh_port', 'query_http_port', 'query_https_port'];

export async function analyzeExistingInstall(deps: AdoptDependencies): Promise<AdoptAnalysis> {
  const installPath = deps.config.ts3.installPath;
  const found: string[] = [];
  const missing: string[] = [];
  for (const name of DETECTABLE_FILES) {
    if (deps.fileExists(join(installPath, name))) found.push(name);
    else missing.push(name);
  }

  const ini = deps.config.ts3.installPath.length > 0 ? parseIni(deps.readFile(join(deps.config.ts3.installPath, 'ts3server.ini'))) : {};
  const ports: PortProbe[] = [];
  const portMap: Array<[string, number]> = [
    ['voice', deps.config.ts3.voicePort],
    ['file transfer', deps.config.ts3.fileTransferPort],
    ['serverquery raw', deps.config.ts3.query.rawPort],
    ['webquery http', deps.config.ts3.query.webQuery.httpPort],
  ];
  for (const [name, port] of portMap) {
    ports.push({ port, name, open: await deps.probePort('127.0.0.1', port) });
  }

  const findings: AdoptFinding[] = [];
  const recommendations: string[] = [];

  if (installPath.length === 0 || !deps.fileExists(installPath)) {
    findings.push({ kind: 'error', message: 'ts3.installPath is not set or does not exist' });
    recommendations.push('配置 ts3.installPath 指向现有 TS3 安装目录后重新运行 adopt。');
    return { installPath, found, missing, ini, ports, findings, recommendations };
  }

  if (!found.includes('ts3server.sqlitedb')) {
    findings.push({ kind: 'warn', message: '未找到 ts3server.sqlitedb，服务器可能尚未初始化' });
  }
  if (!found.includes('ts3server.ini')) {
    findings.push({ kind: 'warn', message: '未找到 ts3server.ini，服务器将使用默认配置' });
  } else {
    const whitelist = ini.query_ip_whitelist ?? '';
    if (!whitelist.split(',').map((entry) => entry.trim()).includes('127.0.0.1')) {
      findings.push({ kind: 'warn', message: `query_ip_whitelist=${whitelist || '(未设置)'} 未包含 127.0.0.1` });
      recommendations.push(
        '将 query_ip_whitelist 设置为 "127.0.0.1"（或 "127.0.0.1,<内网网段>"）后重启 TS3，使 ServerQuery 只接受本机/受控来源。',
      );
    }
  }

  if (deps.config.ts3.query.username.length === 0 || deps.config.ts3.query.password.length === 0) {
    findings.push({ kind: 'info', message: 'ts3-manager 未配置 ServerQuery 凭据' });
    recommendations.push(
      '在 TS3 客户端/ServerQuery 中创建受限登录（不要使用 master serveradmin 作为长期凭据），然后把用户名/密码写入 ts3-manager 配置（config set ts3.query.username / ts3.query.password）。',
    );
  }

  recommendations.push(
    '接管前先备份：ts3-manager backup（会生成 tar.gz + backup-manifest.json）。',
    '需要 systemd 托管时执行：ts3-manager systemd generate ts3server --user ts3 --install-path <路径>。',
    'adopt 为只读分析，未修改任何文件。',
  );
  findings.push({ kind: 'info', message: `发现 ${found.length} 个预期文件，缺失 ${missing.length} 个（缺失项可能正常）` });

  return { installPath, found, missing, ini, ports, findings, recommendations };
}

function parseIni(content: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (content === undefined) return out;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (INI_KEYS.includes(key)) out[key] = value;
  }
  return out;
}
