import type { Patient } from "./types";
import { fullName } from "./format";
import { uid } from "./utils";
import type { PatientDraft } from "./store";

export type TableField = "skip" | "fio" | "lastName" | "firstName" | "middleName" | "phone" | "birthDate" | "email" | "address" | "cardNumber" | "notes";

export const TABLE_FIELDS: Array<{ id: TableField; label: string }> = [
  { id: "skip", label: "Не импортировать" },
  { id: "fio", label: "ФИО целиком" },
  { id: "lastName", label: "Фамилия" },
  { id: "firstName", label: "Имя" },
  { id: "middleName", label: "Отчество" },
  { id: "phone", label: "Телефон" },
  { id: "birthDate", label: "Дата рождения" },
  { id: "email", label: "Почта" },
  { id: "address", label: "Адрес" },
  { id: "cardNumber", label: "Номер карты" },
  { id: "notes", label: "Заметки" },
];

export type TableRow = string[];

export interface ParsedTable {
  headers: string[];
  rows: TableRow[];
  source: "csv" | "xlsx";
}

export type DupAction = "skip" | "update" | "create";

export interface MappedPatient {
  draft: PatientDraft;
  sourceIndex: number;
  duplicate?: Patient;
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else q = !q;
    } else if (ch === sep && !q) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseCsv(text: string): ParsedTable {
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw.split("\n").filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [], source: "csv" };
  const first = lines[0]!;
  const sep = (first.split(";").length > first.split(",").length ? ";" : ",") as string;
  const headers = splitCsvLine(first, sep).map((h) => h || `Столбец`);
  const rows = lines.slice(1).map((l) => {
    const cells = splitCsvLine(l, sep);
    while (cells.length < headers.length) cells.push("");
    return cells.slice(0, headers.length);
  });
  return { headers, rows, source: "csv" };
}

function xmlText(node: string) {
  return node
    .replace(/<[^>]+>/g, "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function inflate(data: Uint8Array) {
  const ds = new DecompressionStream("deflate-raw");
  const blob = new Blob([data as BlobPart]);
  const stream = blob.stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buf: ArrayBuffer) {
  const u8 = new Uint8Array(buf);
  const files = new Map<string, Uint8Array>();
  let i = 0;
  const td = new TextDecoder();
  while (i + 30 < u8.length) {
    if (u8[i] !== 0x50 || u8[i + 1] !== 0x4b) break;
    if (u8[i + 2] === 0x01 && u8[i + 3] === 0x02) break;
    if (!(u8[i + 2] === 0x03 && u8[i + 3] === 0x04)) break;
    const method = u8[i + 8]! | (u8[i + 9]! << 8);
    const comp = u8[i + 18]! | (u8[i + 19]! << 8) | (u8[i + 20]! << 16) | (u8[i + 21]! << 24);
    const nameLen = u8[i + 26]! | (u8[i + 27]! << 8);
    const extraLen = u8[i + 28]! | (u8[i + 29]! << 8);
    const name = td.decode(u8.slice(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extraLen;
    const packed = u8.slice(start, start + comp);
    const body = method === 0 ? packed : method === 8 ? await inflate(packed) : packed;
    files.set(name, body);
    i = start + comp;
  }
  return files;
}

export async function parseTableFile(file: File): Promise<ParsedTable> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type.includes("csv")) {
    return parseCsv(await file.text());
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm") || file.type.includes("spreadsheet")) {
    const files = await unzip(await file.arrayBuffer());
    const shared = new TextDecoder().decode(files.get("xl/sharedStrings.xml") ?? new Uint8Array());
    const strings = [...shared.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1] ?? "");
    const sheetName = [...files.keys()].find((k) => k.startsWith("xl/worksheets/sheet")) || "xl/worksheets/sheet1.xml";
    const sheet = new TextDecoder().decode(files.get(sheetName) ?? new Uint8Array());
    const rowsXml = [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)];
    const table: string[][] = [];
    for (const row of rowsXml) {
      const cells = [...(row[1] ?? "").matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)];
      const line: string[] = [];
      for (const c of cells) {
        const attrs = c[1] ?? "";
        const inner = c[2] ?? "";
        const t = /t="s"/.test(attrs);
        const v = xmlText((inner.match(/<v[^>]*>([\s\S]*?)<\/v>/) ?? ["", ""])[1] ?? "");
        line.push(t ? strings[Number(v)] ?? v : v);
      }
      if (line.some((x) => x.trim())) table.push(line);
    }
    if (!table.length) throw new Error("В таблице нет строк");
    const width = Math.max(...table.map((r) => r.length));
    const headers = (table[0] ?? []).map((h, i) => h.trim() || `Столбец ${i + 1}`);
    while (headers.length < width) headers.push(`Столбец ${headers.length + 1}`);
    const rows = table.slice(1).map((r) => {
      const copy = [...r];
      while (copy.length < headers.length) copy.push("");
      return copy;
    });
    return { headers, rows, source: "xlsx" };
  }
  throw new Error("Нужен файл CSV или XLSX");
}

export function guessMapping(headers: string[]): TableField[] {
  return headers.map((h) => {
    const n = h.toLowerCase().replace(/\s+/g, " ");
    if (/фио|ф\.?\s*и\.?\s*о|name|пациент/.test(n) && !/фам/.test(n)) return "fio";
    if (/фам/.test(n) || n === "lastname") return "lastName";
    if (/^имя$|firstname|имя пациента/.test(n)) return "firstName";
    if (/отчеств|middle/.test(n)) return "middleName";
    if (/телефон|phone|моб/.test(n)) return "phone";
    if (/рожден|birth|дата рожд/.test(n)) return "birthDate";
    if (/почт|email|e-mail/.test(n)) return "email";
    if (/адрес|address/.test(n)) return "address";
    if (/карт|card/.test(n)) return "cardNumber";
    if (/замет|note|коммент/.test(n)) return "notes";
    return "skip";
  });
}

function splitFio(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { lastName: parts[0] ?? "", firstName: parts[1] ?? "", middleName: parts.slice(2).join(" ") };
}

function normalizePhone(p: string) {
  return p.replace(/\D/g, "").slice(-10);
}

function parseBirth(v: string) {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    const d = m[1]!.padStart(2, "0");
    const mo = m[2]!.padStart(2, "0");
    let y = m[3]!;
    if (y.length === 2) y = Number(y) > 30 ? `19${y}` : `20${y}`;
    return `${y}-${mo}-${d}`;
  }
  if (/^\d{5}$/.test(s)) {
    const n = Number(s);
    const d = new Date(Date.UTC(1899, 11, 30 + n));
    return d.toISOString().slice(0, 10);
  }
  return "";
}

export function mapRows(
  table: ParsedTable,
  mapping: TableField[],
  existing: Patient[],
): MappedPatient[] {
  return table.rows.map((row, sourceIndex) => {
    const draft: PatientDraft = {
      lastName: "",
      firstName: "",
      middleName: "",
      birthDate: "",
      phone: "",
      email: "",
      address: "",
      allergies: "",
      chronic: "",
      notes: "",
      cardNumber: "",
      referredById: "",
      sourceKind: "none",
      sourceSocial: "",
      sourceNote: "",
      tagIds: [],
      medicalFlags: [],
      medicalNote: "",
      discountTypeId: "",
      recallStatus: "none",
    };
    mapping.forEach((field, i) => {
      const v = (row[i] ?? "").trim();
      if (!v || field === "skip") return;
      if (field === "fio") {
        const p = splitFio(v);
        draft.lastName = draft.lastName || p.lastName;
        draft.firstName = draft.firstName || p.firstName;
        draft.middleName = draft.middleName || p.middleName;
      } else if (field === "birthDate") draft.birthDate = parseBirth(v);
      else if (field === "phone") draft.phone = v;
      else if (field === "lastName") draft.lastName = v;
      else if (field === "firstName") draft.firstName = v;
      else if (field === "middleName") draft.middleName = v;
      else if (field === "email") draft.email = v;
      else if (field === "address") draft.address = v;
      else if (field === "cardNumber") draft.cardNumber = v;
      else if (field === "notes") draft.notes = v;
    });
    const phone = normalizePhone(draft.phone);
    const fio = fullName(draft).toLowerCase();
    const duplicate = existing.find((p) => {
      const samePhone = phone.length >= 10 && normalizePhone(p.phone) === phone;
      const sameFio = fio.length > 4 && fullName(p).toLowerCase() === fio;
      return samePhone || sameFio;
    });
    return { draft, sourceIndex, duplicate };
  });
}

export function emptyId() {
  return uid("p");
}
