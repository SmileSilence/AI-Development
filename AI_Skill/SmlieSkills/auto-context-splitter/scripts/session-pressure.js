#!/usr/bin/env node
/**
 * session-pressure.js — 会话累计上下文压力检测辅助工具
 *
 * 用途：估算一个 DSH 会话（或当前对话文本）的累计 token 用量与窗口占比，
 * 帮助判断"累计超长"是否需要压缩（/compact 或自动压缩）。
 *
 * 用法：
 *   node session-pressure.js <文件或目录>
 *     - 传入 DSH 会话日志目录（含 session.jsonl），估算整个会话的累计 token
 *     - 传入任意文本文件，估算该文本的 token 量
 *   node session-pressure.js --window 128000 <路径>
 *     - 指定模型上下文窗口（默认 128k tokens）
 *
 * 输出：估算 token 数、窗口占比、压力等级与压缩建议。
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_WINDOW = 128000;
const AUTO_COMPACT_RATIO = 0.8; // 接近窗口 80% 视为压力区

/** 估算文本 token 数（中文 0.15/字、英文 1.25/词、其他 0.25/字符） */
function estimateTokens(text) {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.round(chineseChars * 0.15 + englishWords * 1.25 + otherChars * 0.25);
}

/** 收集会话日志文本 */
function collectSessionText(target) {
  if (!fs.existsSync(target)) {
    throw new Error(`路径不存在: ${target}`);
  }

  const stat = fs.statSync(target);
  if (stat.isFile()) {
    return fs.readFileSync(target, 'utf8');
  }

  // 目录：递归收集 .jsonl 会话日志
  const texts = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.jsonl(\.zstd)?$/.test(entry.name)) {
        texts.push(fs.readFileSync(full, 'utf8'));
      }
    }
  };
  walk(target);
  if (texts.length === 0) throw new Error(`目录下未找到会话日志: ${target}`);
  return texts.join('\n');
}

function main() {
  const args = process.argv.slice(2);

  let windowSize = DEFAULT_WINDOW;
  let target = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--window' && args[i + 1]) {
      windowSize = parseInt(args[i + 1], 10);
      if (isNaN(windowSize) || windowSize <= 0) {
        console.error('无效的 --window 参数');
        process.exit(1);
      }
      i++;
    } else {
      target = args[i];
    }
  }

  if (!target) {
    console.log('用法: node session-pressure.js [--window <tokens>] <会话目录|文本文件>');
    process.exit(1);
  }

  const text = collectSessionText(target);
  const tokens = estimateTokens(text);
  const ratio = tokens / windowSize;

  let pressure = '低';
  let advice = '会话空间充足，无需压缩。';
  if (ratio >= 1) {
    pressure = '已溢出';
    advice = '会话累计上下文已超出窗口，必须压缩（自动压缩应已触发；也可执行 /compact）。';
  } else if (ratio >= AUTO_COMPACT_RATIO) {
    pressure = '高（压力区）';
    advice = '接近自动压缩阈值，建议执行 /compact 提前压缩早期历史，或等待自动压缩。';
  } else if (ratio >= 0.5) {
    pressure = '中';
    advice = '会话增长较快，注意控制，接近阈值时压缩。';
  }

  console.log('=== 会话上下文压力检测 ===');
  console.log(`输入来源: ${target}`);
  console.log(`估算累计 token: ${tokens.toLocaleString()}`);
  console.log(`上下文窗口:     ${windowSize.toLocaleString()}`);
  console.log(`窗口占比:       ${(ratio * 100).toFixed(1)}%`);
  console.log(`压力等级:       ${pressure}`);
  console.log(`建议:           ${advice}`);
  console.log('=============================');
}

main();