import assert from "node:assert/strict";
import { test } from "node:test";
import { canChangeOwnRole, canManageStaff, isLastActiveAccount } from "./staff.ts";
import type { Doctor, DoctorRole } from "./types.ts";

function doc(id: string, role: DoctorRole, active = true): Doctor {
  return {
    id,
    lastName: id,
    firstName: "A",
    middleName: "",
    specialty: "Стоматолог",
    color: "#000",
    login: id,
    passwordHash: "x",
    passwordSalt: "s",
    role,
    active,
    sharePercent: 40,
  };
}

test("единственный включённый врач может управлять кабинетом", () => {
  const actor = doc("d1", "doctor");
  const opts = { requireLogin: true, actor, doctors: [actor] };
  assert.equal(isLastActiveAccount(opts.doctors, actor.id), true);
  assert.equal(canManageStaff(opts), true);
  assert.equal(canChangeOwnRole(opts), true);
});

test("единственный включённый при выключенных коллегах тоже не блокируется", () => {
  const actor = doc("d1", "doctor");
  const off = doc("d2", "admin", false);
  const opts = { requireLogin: true, actor, doctors: [actor, off] };
  assert.equal(isLastActiveAccount(opts.doctors, actor.id), true);
  assert.equal(canManageStaff(opts), true);
});

test("обычный врач при живом главном не меняет чужие роли", () => {
  const actor = doc("d1", "doctor");
  const chief = doc("c1", "chief");
  const opts = { requireLogin: true, actor, doctors: [actor, chief] };
  assert.equal(canManageStaff(opts), false);
  assert.equal(canChangeOwnRole(opts), false);
});

test("если среди включённых нет главврача и админа — можно сменить свою роль", () => {
  const a = doc("d1", "doctor");
  const b = doc("d2", "doctor");
  const opts = { requireLogin: true, actor: a, doctors: [a, b] };
  assert.equal(canManageStaff(opts), false);
  assert.equal(canChangeOwnRole(opts), true);
});

test("главный врач всегда управляет", () => {
  const actor = doc("c1", "chief");
  const other = doc("d1", "doctor");
  assert.equal(canManageStaff({ requireLogin: true, actor, doctors: [actor, other] }), true);
});
