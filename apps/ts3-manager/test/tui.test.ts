import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from '../src/config/config.ts';
import { defaultConfig, validateConfig } from '../src/domain/schemas.ts';
import {
  buildLanguageMenu,
  buildMainMenu,
  chooseLanguage,
  languageSwitchMessage,
  persistLanguage,
} from '../src/cli/tui.ts';
import type { CliContext } from '../src/cli/context.ts';
import { cleanupDir, tempDir, writeTempConfig } from './util.ts';

test('main menu is rendered in both languages', () => {
  const zh = buildMainMenu('zh');
  assert.ok(zh.includes('TS3Pilot 控制台'));
  assert.ok(zh.includes('[1] 一键安装全新 TS3 服务器'));
  assert.ok(zh.includes('[6] 立即执行全量备份'));
  assert.ok(zh.includes('[8] 配置开机自启与守护进程'));
  assert.ok(zh.includes('[9] 更改控制台语言'));
  assert.ok(zh.includes('[0] 退出控制台'));
  assert.ok(!zh.includes('(Install)'));

  const en = buildMainMenu('en');
  assert.ok(en.includes('TS3Pilot Console'));
  assert.ok(en.includes('[1] Install a fresh TS3 server'));
  assert.ok(en.includes('[6] Run a full backup now'));
  assert.ok(en.includes('[8] Configure autostart & daemon'));
  assert.ok(en.includes('[0] Exit console'));
});

test('language preference is persisted to the config', () => {
  const dir = tempDir('tui');
  try {
    const { path } = writeTempConfig(dir);
    persistLanguage(path, 'zh');
    assert.equal(readConfig(path).language, 'zh');
    persistLanguage(path, 'en');
    assert.equal(readConfig(path).language, 'en');
  } finally {
    cleanupDir(dir);
  }
});

test('language menu is fully bilingual regardless of the active language', () => {
  const menu = buildLanguageMenu();
  assert.ok(menu.includes('[1] English (英文)'));
  assert.ok(menu.includes('[2] 简体中文 (中文)'));
  assert.ok(menu.includes('Please select / 请选择 (1/2)'));
  assert.ok(languageSwitchMessage('en').includes('Language set to English'));
  assert.ok(languageSwitchMessage('en').includes('语言已切换为英文'));
  assert.ok(languageSwitchMessage('zh').includes('语言已切换为简体中文'));
  assert.ok(languageSwitchMessage('zh').includes('Language set to Simplified Chinese'));
});

test('chooseLanguage can switch from either language direction', async () => {
  const dir = tempDir('tui-choose');
  try {
    const { path } = writeTempConfig(dir);
    const ctx = { cfgPath: path } as unknown as CliContext;

    const pickEn = makeQuestion(['1']);
    assert.equal(await chooseLanguage(pickEn, ctx), 'en');
    assert.equal(readConfig(path).language, 'en');

    const pickZh = makeQuestion(['2']);
    assert.equal(await chooseLanguage(pickZh, ctx), 'zh');
    assert.equal(readConfig(path).language, 'zh');

    // Invalid input first, then a valid pick, proves the loop keeps prompting bilingually.
    const pickAfterInvalid = makeQuestion(['9', '1']);
    assert.equal(await chooseLanguage(pickAfterInvalid, ctx), 'en');
    assert.equal(readConfig(path).language, 'en');
  } finally {
    cleanupDir(dir);
  }
});

test('config schema accepts only empty/zh/en for language', () => {
  const config = defaultConfig();
  assert.equal(config.language, '');
  assert.equal(validateConfig({ ...config, language: 'zh' }).language, 'zh');
  assert.equal(validateConfig({ ...config, language: 'en' }).language, 'en');
  assert.throws(() => validateConfig({ ...config, language: 'fr' }));
});

function makeQuestion(answers: readonly string[]): (prompt: string) => Promise<string> {
  const queue = [...answers];
  return async (_prompt: string) => queue.shift() ?? '';
}
