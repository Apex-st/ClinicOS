import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decryptBytes,
  decryptJson,
  encryptBytes,
  encryptJson,
  formatRecoveryKey,
  packPhoto,
  parseRecoveryKey,
  randomBytes,
  recoverySecret,
  unpackPhoto,
  unwrapDek,
  wrapDek,
} from "./crypto.ts";

test("json roundtrip", async () => {
  const dek = randomBytes(32);
  const payload = { patients: [{ name: "Иванов" }], n: 7 };
  const enc = await encryptJson(dek, payload);
  const out = await decryptJson<typeof payload>(dek, enc.iv, enc.ct);
  assert.deepEqual(out, payload);
});

test("wrap / unwrap dek", async () => {
  const dek = randomBytes(32);
  const wrap = await wrapDek(dek, "пароль-врача");
  const opened = await unwrapDek(wrap, "пароль-врача");
  assert.ok(opened);
  assert.deepEqual([...opened!], [...dek]);
  const bad = await unwrapDek(wrap, "не тот");
  assert.equal(bad, null);
});

test("recovery key format", () => {
  const bytes = randomBytes(16);
  const key = formatRecoveryKey(bytes);
  assert.match(key, /^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/);
  const parsed = parseRecoveryKey(key.toLowerCase());
  assert.ok(parsed);
  assert.deepEqual([...parsed!], [...bytes]);
  assert.equal(recoverySecret(key).length, 32);
});

test("photo pack", async () => {
  const dek = randomBytes(32);
  const plain = new Uint8Array([1, 2, 3, 4, 5]);
  const { iv, ct } = await encryptBytes(dek, plain);
  const packed = packPhoto(iv, ct);
  const unpacked = unpackPhoto(packed);
  assert.ok(unpacked);
  const out = await decryptBytes(dek, unpacked!.iv, unpacked!.ct);
  assert.deepEqual([...out], [...plain]);
  assert.equal(unpackPhoto(plain), null);
});
