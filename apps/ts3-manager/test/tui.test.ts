import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from '../src/config/config.ts';
import { defaultConfig, validateConfig } from '../src/domain/schemas.ts';
import { buildMainMenu, persistLanguage } from '../src/cli/tui.ts';
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

test('config schema accepts only empty/zh/en for language', () => {
  const config = defaultConfig();
  assert.equal(config.language, '');
  assert.equal(validateConfig({ ...config, language: 'zh' }).language, 'zh');
  assert.equal(validateConfig({ ...config, language: 'en' }).language, 'en');
  assert.throws(() => validateConfig({ ...config, language: 'fr' }));
});
