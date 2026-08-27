import { existsSync, realpathSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { updateConfig } from '../config/config.ts';
import { isAppError } from '../domain/errors.ts';
import type { CliContext } from './context.ts';
import { printLine } from './print.ts';
import { runAdoptCommand } from './commands/adopt.ts';
import { runApiCommand } from './commands/api.ts';
import { runBackupCommand } from './commands/backupCmd.ts';
import { runInstallCommand } from './commands/install.ts';
import { runLogsCommand } from './commands/logs.ts';
import { runServiceCommand } from './commands/service.ts';
import { runSystemdCommand } from './commands/systemd.ts';
import { runUpdateCommand } from './commands/update.ts';

export type TuiLanguage = 'zh' | 'en';

type Question = (prompt: string) => Promise<string>;

export function persistLanguage(cfgPath: string, language: TuiLanguage): void {
  updateConfig(cfgPath, (config) => ({ ...config, language }));
}

/**
 * The language selection menu is intentionally bilingual no matter which
 * language is currently active, so a user who accidentally switched can
 * always find the way back without guessing.
 */
export function buildLanguageMenu(): string {
  return [
    '',
    '[1] English (英文)',
    '[2] 简体中文 (中文)',
    'Please select / 请选择 (1/2): ',
    '',
  ].join('\n');
}

export function languageSwitchMessage(language: TuiLanguage): string {
  return language === 'zh' ? '语言已切换为简体中文 / Language set to Simplified Chinese' : 'Language set to English / 语言已切换为英文';
}

export function buildMainMenu(language: TuiLanguage): string {
  if (language === 'zh') {
    return [
      '=== TS3Pilot 控制台 ===',
      '【系统初始化】',
      '  [1] 一键安装全新 TS3 服务器',
      '  [2] 扫描并接管现有 TS3 服务器',
      '【日常运维】',
      '  [3] 查看服务运行状态与日志',
      '  [4] 启动/停止/重启服务',
      '  [8] 配置开机自启与守护进程',
      '【数据与安全】',
      '  [5] 生成 WordPress 绑定配对码',
      '  [6] 立即执行全量备份',
      '  [7] 检查并更新 TS3Pilot',
      '  [9] 更改控制台语言',
      '[0] 退出控制台',
      '',
    ].join('\n');
  }
  return [
    '=== TS3Pilot Console ===',
    '【System Setup】',
    '  [1] Install a fresh TS3 server',
    '  [2] Scan & adopt an existing TS3 server',
    '【Daily Ops】',
    '  [3] View service status & logs',
    '  [4] Start / Stop / Restart service',
    '  [8] Configure autostart & daemon',
    '【Data & Security】',
    '  [5] Generate WordPress pairing code',
    '  [6] Run a full backup now',
    '  [7] Check & update TS3Pilot',
    '  [9] Change language',
    '[0] Exit console',
    '',
  ].join('\n');
}

export async function runTui(ctx: CliContext): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let closed = false;
  const question: Question = (prompt) =>
    new Promise((resolve) => {
      if (closed) {
        resolve('');
        return;
      }
      const onClose = (): void => {
        closed = true;
        resolve('');
      };
      rl.once('close', onClose);
      rl.question(prompt, (answer) => {
        rl.removeListener('close', onClose);
        resolve(answer);
      });
    });
  rl.on('SIGINT', () => {
    rl.close();
    process.exit(130);
  });

  try {
    let language: TuiLanguage;
    if (ctx.config.language === 'zh' || ctx.config.language === 'en') {
      language = ctx.config.language;
    } else {
      language = await chooseLanguage(question, ctx);
    }

    for (;;) {
      if (closed) break;
      printLine(buildMainMenu(language));
      const answer = (await question('> ')).trim();
      if (answer === '0') {
        printLine(language === 'zh' ? '再见！' : 'Goodbye!');
        break;
      }
      if (answer === '' && closed) break;
      try {
        const nextLanguage = await dispatchTuiChoice(language, answer, ctx, question);
        if (nextLanguage !== undefined) language = nextLanguage;
      } catch (error) {
        if (isAppError(error)) {
          printLine(`error [${error.code}]: ${error.message}`);
        } else {
          printLine(`error: ${error instanceof Error ? error.message : 'unknown'}`);
        }
      }
      if (closed) break;
      await question(language === 'zh' ? '按回车键返回主菜单...' : 'Press Enter to return to the main menu...');
    }
  } finally {
    rl.close();
  }
}

export async function chooseLanguage(question: Question, ctx: CliContext): Promise<TuiLanguage> {
  printLine('');
  printLine('Welcome to TS3Pilot! 欢迎使用 TS3Pilot！');
  for (;;) {
    printLine(buildLanguageMenu());
    const answer = (await question('Please select / 请选择 (1/2): ')).trim();
    if (answer === '1') {
      persistLanguage(ctx.cfgPath, 'en');
      printLine(languageSwitchMessage('en'));
      return 'en';
    }
    if (answer === '2') {
      persistLanguage(ctx.cfgPath, 'zh');
      printLine(languageSwitchMessage('zh'));
      return 'zh';
    }
    printLine('Invalid choice / 无效选择，请输入 1 或 2。');
  }
}

export async function dispatchTuiChoice(
  language: TuiLanguage,
  choice: string,
  ctx: CliContext,
  question: Question,
): Promise<TuiLanguage | undefined> {
  const zh = language === 'zh';
  switch (choice) {
    case '1': {
      const ok = await question(zh ? '已阅读并同意 TeamSpeak 官方 EULA？(y/N): ' : 'Have you read and accepted the TeamSpeak EULA? (y/N): ');
      if (ok.trim().toLowerCase() !== 'y') {
        printLine(zh ? '已取消安装。' : 'Install cancelled.');
        return;
      }
      await runInstallCommand(ctx, {
        version: '3.13.7',
        'install-path': ctx.config.ts3.installPath.length > 0 ? ctx.config.ts3.installPath : '/srv/ts3',
        'accept-eula': true,
        'setup-firewall': true,
      });
      return;
    }
    case '2':
      await runAdoptCommand(ctx);
      return;
    case '3':
      await runServiceCommand(ctx, 'status');
      await runLogsCommand(ctx, { lines: '50' });
      return;
    case '4':
      await serviceControlMenu(language, ctx, question);
      return;
    case '5':
      await runApiCommand(ctx, ['enable'], { port: '17880' });
      return;
    case '6':
      await runBackupCommand(ctx, {});
      return;
    case '7':
      await runUpdateCommand(ctx, [], {});
      return;
    case '8':
      await autostartMenu(language, ctx, question);
      return;
    case '9':
      return changeLanguageMenu(ctx, question);
    default:
      printLine(zh ? `无效选项：${choice}` : `Invalid option: ${choice}`);
  }
  return undefined;
}

async function serviceControlMenu(language: TuiLanguage, ctx: CliContext, question: Question): Promise<void> {
  const zh = language === 'zh';
  printLine(zh ? '服务控制' : 'Service Control');
  printLine(zh ? '  [1] 启动  [2] 停止  [3] 重启  [4] 状态' : '  [1] Start  [2] Stop  [3] Restart  [4] Status');
  const answer = (await question('> ')).trim();
  const action = answer === '1' ? 'start' : answer === '2' ? 'stop' : answer === '3' ? 'restart' : answer === '4' ? 'status' : undefined;
  if (action === undefined) {
    printLine(zh ? '无效选项。' : 'Invalid option.');
    return;
  }
  await runServiceCommand(ctx, action);
}

async function autostartMenu(language: TuiLanguage, ctx: CliContext, question: Question): Promise<void> {
  const zh = language === 'zh';
  const user = (await question(zh ? '请输入运行用户（默认 ts3）: ' : 'Service user (default ts3): ')).trim() || 'ts3';
  const binaryPath = resolveTuiBinaryPath();
  await runSystemdCommand(ctx, ['generate', 'ts3-agent'], {
    user,
    group: user,
    'exec-start': `${binaryPath} agent`,
    config: ctx.cfgPath,
  });
  printLine(
    zh
      ? '请以 root 将上方 unit 保存到 /etc/systemd/system/ts3-agent.service，然后执行：systemctl daemon-reload && systemctl enable --now ts3-agent.service'
      : 'As root, save the unit above to /etc/systemd/system/ts3-agent.service, then run: systemctl daemon-reload && systemctl enable --now ts3-agent.service',
  );
}

async function changeLanguageMenu(ctx: CliContext, question: Question): Promise<TuiLanguage | undefined> {
  printLine('=== Language / 语言 ===');
  for (;;) {
    printLine(buildLanguageMenu());
    const pick = (await question('Please select / 请选择 (1/2): ')).trim();
    if (pick === '1') {
      persistLanguage(ctx.cfgPath, 'en');
      printLine(languageSwitchMessage('en'));
      return 'en';
    }
    if (pick === '2') {
      persistLanguage(ctx.cfgPath, 'zh');
      printLine(languageSwitchMessage('zh'));
      return 'zh';
    }
    printLine('Invalid choice / 无效选择，请输入 1 或 2。');
  }
}

function resolveTuiBinaryPath(): string {
  const argv = process.argv[1];
  if (argv !== undefined && existsSync(argv)) {
    try {
      return realpathSync(argv);
    } catch {
      // fall through
    }
  }
  return '/opt/ts3pilot/ts3pilot';
}
