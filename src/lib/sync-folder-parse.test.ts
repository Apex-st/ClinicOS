import assert from "node:assert/strict";
import { test } from "node:test";
import { folderNameFromRelativePath, isCancelError, isTopLevelSyncFile } from "./sync-folder-parse.ts";

test("имя папки из webkitRelativePath", () => {
  assert.equal(folderNameFromRelativePath("ClinicOS/ClinicOS-cabinet.denta"), "ClinicOS");
  assert.equal(folderNameFromRelativePath("Диск/подпапка/файл.denta"), "Диск");
  assert.equal(folderNameFromRelativePath(""), "Папка");
});

test("файл кабинета только в корне выбранной папки", () => {
  assert.equal(isTopLevelSyncFile("ClinicOS/ClinicOS-cabinet.denta", "ClinicOS-cabinet.denta"), true);
  assert.equal(isTopLevelSyncFile("ClinicOS-cabinet.denta", "ClinicOS-cabinet.denta"), true);
  assert.equal(isTopLevelSyncFile("ClinicOS/вложенная/ClinicOS-cabinet.denta", "ClinicOS-cabinet.denta"), false);
  assert.equal(isTopLevelSyncFile("ClinicOS/readme.txt", "readme.txt"), false);
});

test("отмена выбора", () => {
  assert.equal(isCancelError(new DOMException("The user aborted a request.", "AbortError")), true);
  assert.equal(isCancelError(new Error("canceled")), true);
  assert.equal(isCancelError(new Error("permission-denied")), false);
});
