#!/usr/bin/env node
// Generates a password hash in the same format src/lib/password.ts expects
// (salt:hash, scrypt). Use this to add new member accounts by hand via the
// Turso SQL console — see README.md "새 계정 추가하기".
//
//   node scripts/hash-password.mjs <비밀번호>

import crypto from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("사용법: node scripts/hash-password.mjs <비밀번호>");
  process.exit(1);
}

const KEY_LENGTH = 64;
const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
console.log(`${salt}:${hash}`);
