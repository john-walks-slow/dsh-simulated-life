#!/usr/bin/env node
/**
 * check_wake_schedule.mjs — 校验 .life/wake_schedule.json（dsh-proactive 声明式闹钟文件）
 *
 * 用法：node check_wake_schedule.mjs <path/to/wake_schedule.json>
 * 退出码：0 = 通过（warn 不算失败）；1 = 存在 error（必须修正后重写）。
 *
 * 校验与 dsh-proactive/declared.ts 的解析语义对齐：version=1、条目 id 形态、
 * 选择器四选一、prompt 必填、嵌套 target 键、重复 id、时间可解析；at 在过去
 * 记 warn（声明式语义：错过不补火，闹钟不会创建）。
 */

import { readFileSync, statSync } from "node:fs";

const ENTRY_KEYS = new Set(["id", "prompt", "at", "after_seconds", "every_seconds", "cron", "jitter_seconds", "time_zone", "respect_quiet_hours", "compaction", "target"]);
const FILE_DEFAULT_KEYS = new Set(["time_zone", "respect_quiet_hours", "jitter_seconds", "compaction", "target"]);
const TARGET_KEYS = new Set(["mode", "workspace_path", "workspace_id", "session_id", "preset_id", "provider", "model"]);
const ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

const errors = [];
const warns = [];

function fail(message) { errors.push(message); }
function warn(message) { warns.push(message); }

function checkSelector(entry, label) {
  const selectors = ["at", "after_seconds", "every_seconds", "cron"].filter((key) => entry[key] !== undefined);
  if (selectors.length !== 1) {
    fail(label + ": 选择器必须四选一（at / after_seconds / every_seconds / cron），当前: " + (selectors.join(", ") || "无"));
    return false;
  }
  if (entry.at !== undefined) {
    if (typeof entry.at !== "string" || Number.isNaN(Date.parse(entry.at)) || !/^(?:\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(entry.at)) {
      fail(label + ': at 必须是带显式时区的 RFC 3339 字符串，例如 "2026-09-18T14:20:00+08:00"');
      return false;
    }
    if (Date.parse(entry.at) <= Date.now()) {
      warn(label + ": at 在过去（声明式语义不补火，该条不会创建闹钟）");
    }
  }
  if (entry.after_seconds !== undefined && (typeof entry.after_seconds !== "number" || !Number.isSafeInteger(entry.after_seconds) || entry.after_seconds <= 0)) {
    fail(label + ": after_seconds 必须是正整数");
    return false;
  }
  if (entry.every_seconds !== undefined && (typeof entry.every_seconds !== "number" || !Number.isSafeInteger(entry.every_seconds) || entry.every_seconds < 300)) {
    fail(label + ": every_seconds 必须是 >= 300 的整数");
    return false;
  }
  if (entry.cron !== undefined && (typeof entry.cron !== "string" || !/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(entry.cron))) {
    fail(label + ": cron 必须是五字段数字表达式（minute hour dom month dow）");
    return false;
  }
  return true;
}

function checkTarget(target, label) {
  if (typeof target !== "object" || target === null || Array.isArray(target)) {
    fail(label + ": target 必须是对象");
    return;
  }
  for (const key of Object.keys(target)) {
    if (!TARGET_KEYS.has(key)) fail(label + ": target 不支持字段 \"" + key + "\"（允许: " + [...TARGET_KEYS].join(", ") + "）");
  }
  if (target.mode !== undefined && !["resume", "fork", "new"].includes(target.mode)) {
    fail(label + ": target.mode 必须是 resume / fork / new");
  }
}

const path = process.argv[2];
if (!path) {
  console.error("用法: node check_wake_schedule.mjs <wake_schedule.json>");
  process.exit(1);
}
try {
  if (!statSync(path).isFile()) fail(path + ": 不是常规文件");
} catch {
  fail(path + ": 文件不存在或不可读");
  process.exit(1);
}

let doc;
try {
  doc = JSON.parse(readFileSync(path, "utf8"));
} catch (error) {
  fail(path + ": JSON 解析失败（确认用 tmp+rename 原子写）: " + error.message);
  process.exit(1);
}

if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
  fail("顶层必须是对象");
  process.exit(1);
}
if (doc.version !== 1) fail('"version" 必须是 1');
if (!Array.isArray(doc.entries)) fail('"entries" 必须是数组');
if (doc.entries === undefined || Array.isArray(doc.entries)) {
  for (const key of Object.keys(doc)) {
    if (key === "version" || key === "entries") continue;
    if (!FILE_DEFAULT_KEYS.has(key)) fail('未知顶层字段 "' + key + '"（允许: ' + [...FILE_DEFAULT_KEYS].join(", ") + "）");
  }
  if (doc.target !== undefined) checkTarget(doc.target, "顶层 target");
}

const seen = new Set();
for (const [index, entry] of (Array.isArray(doc.entries) ? doc.entries : []).entries()) {
  const label = "entries[" + index + "]";
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    fail(label + ": 必须是对象");
    continue;
  }
  if (typeof entry.id !== "string" || !ID_PATTERN.test(entry.id)) {
    fail(label + ': id 必须是 1..100 个 [A-Za-z0-9._-] 字符');
    continue;
  }
  const idLabel = label + "(id=" + entry.id + ")";
  if (seen.has(entry.id)) fail(idLabel + ": 重复 id");
  seen.add(entry.id);
  for (const key of Object.keys(entry)) {
    if (!ENTRY_KEYS.has(key)) fail(idLabel + ': 未知字段 "' + key + '"');
  }
  if (typeof entry.prompt !== "string" || entry.prompt.trim().length === 0) fail(idLabel + ": prompt 必填（写给 living agent 的第二人称此刻指令）");
  else if (entry.prompt.length > 4000) fail(idLabel + ": prompt 超过 4000 字符上限");
  if (checkSelector(entry, idLabel)) {
    if (entry.jitter_seconds !== undefined && (typeof entry.jitter_seconds !== "number" || !Number.isSafeInteger(entry.jitter_seconds) || entry.jitter_seconds < 0 || entry.jitter_seconds > 86400)) {
      fail(idLabel + ": jitter_seconds 必须是 0..86400 的整数");
    }
  }
  if (entry.target !== undefined) checkTarget(entry.target, idLabel + " target");
}

for (const message of errors) console.error("ERROR " + message);
for (const message of warns) console.warn("WARN  " + message);
console.log((errors.length === 0 ? "OK" : "FAIL") + " — " + (doc.entries?.length ?? 0) + " entries, " + errors.length + " error(s), " + warns.length + " warning(s): " + path);
process.exit(errors.length === 0 ? 0 : 1);
