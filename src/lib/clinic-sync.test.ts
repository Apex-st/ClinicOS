import assert from "node:assert/strict";
import { test } from "node:test";
import { decideSync } from "./sync-decide.ts";

const base = {
  dirty: false,
  lastRev: 0,
  remoteRev: null as number | null,
  localSyncId: "a",
  localDeviceId: "dev1",
};

test("пустая папка — первая запись", () => {
  assert.equal(decideSync({ ...base, hasRemote: false }), "init");
});

test("коллега без своей копии забирает файл из папки", () => {
  assert.equal(
    decideSync({
      ...base,
      hasRemote: true,
      lastRev: 0,
      remoteRev: 4,
      remoteSyncId: "other",
    }),
    "pull",
  );
});

test("локальные правки при той же ревизии — отдать в папку", () => {
  assert.equal(
    decideSync({
      ...base,
      hasRemote: true,
      dirty: true,
      lastRev: 3,
      remoteRev: 3,
      remoteSyncId: "a",
    }),
    "push",
  );
});

test("в папке новее, локально не меняли — взять", () => {
  assert.equal(
    decideSync({
      ...base,
      hasRemote: true,
      lastRev: 3,
      remoteRev: 5,
      remoteSyncId: "a",
    }),
    "pull",
  );
});

test("оба меняли — спросить", () => {
  assert.equal(
    decideSync({
      ...base,
      hasRemote: true,
      dirty: true,
      lastRev: 3,
      remoteRev: 5,
      remoteSyncId: "a",
    }),
    "conflict",
  );
});

test("другой кабинет в той же папке — спросить", () => {
  assert.equal(
    decideSync({
      ...base,
      hasRemote: true,
      lastRev: 2,
      remoteRev: 8,
      remoteSyncId: "other",
    }),
    "conflict",
  );
});

test("свой же файл после записи — ничего", () => {
  assert.equal(
    decideSync({
      ...base,
      hasRemote: true,
      lastRev: 4,
      remoteRev: 4,
      remoteSyncId: "a",
      remoteDeviceId: "dev1",
    }),
    "noop",
  );
});
