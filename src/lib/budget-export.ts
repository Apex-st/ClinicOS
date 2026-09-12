import { zipSync, strToU8 } from "fflate";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import {
  categoryShare,
  payMethodLabel,
  type BudgetTotals,
  type LedgerOp,
} from "./budget";
import { formatDate, fullName, money } from "./format";
import { embedPdfFonts, pdfBlobFromBytes } from "./pdf-fonts";
import type { BudgetCategory, BudgetVendor, Patient, Settings } from "./types";

function xmlEsc(s: string) {
  return s
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

function csvCell(s: string | number) {
  const t = String(s ?? "");
  if (/[;"\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

export function budgetCsv(
  ops: LedgerOp[],
  categories: BudgetCategory[],
  patients: Patient[],
  vendors: BudgetVendor[],
  customPay: string[],
) {
  const head = ["Дата", "Тип", "Категория", "Описание", "Сумма", "Способ оплаты", "Источник", "Пациент", "Поставщик"];
  const rows = ops.map((op) => [
    op.date,
    op.kind === "income" ? "Доход" : "Расход",
    categories.find((c) => c.id === op.categoryId)?.name || "",
    op.title,
    op.kind === "income" ? op.amount : -op.amount,
    payMethodLabel(op.method, customPay),
    op.source === "visit" ? "Касса / оплата пациента" : op.source === "recurring" ? "Регулярный расход" : "Вручную",
    op.patientId ? fullName(patients.find((p) => p.id === op.patientId) || { lastName: "", firstName: "", middleName: "" }) : "",
    op.vendorId ? vendors.find((v) => v.id === op.vendorId)?.name || "" : "",
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(";")).join("\n");
}

export function budgetXlsxBlob(
  ops: LedgerOp[],
  categories: BudgetCategory[],
  patients: Patient[],
  vendors: BudgetVendor[],
  customPay: string[],
): Blob {
  const rows: string[][] = [
    ["Дата", "Тип", "Категория", "Описание", "Сумма", "Способ оплаты", "Источник", "Пациент", "Поставщик"],
    ...ops.map((op) => [
      op.date,
      op.kind === "income" ? "Доход" : "Расход",
      categories.find((c) => c.id === op.categoryId)?.name || "",
      op.title,
      String(op.kind === "income" ? op.amount : -op.amount),
      payMethodLabel(op.method, customPay),
      op.source === "visit" ? "Касса" : op.source === "recurring" ? "Регулярный" : "Вручную",
      op.patientId ? fullName(patients.find((p) => p.id === op.patientId) || { lastName: "", firstName: "", middleName: "" }) : "",
      op.vendorId ? vendors.find((v) => v.id === op.vendorId)?.name || "" : "",
    ]),
  ];
  const sheetRows = rows
    .map((row, ri) => {
      const cells = row
        .map((val, ci) => {
          const col = String.fromCharCode(65 + ci);
          const isNum = ci === 4 && ri > 0 && /^-?\d+$/.test(val);
          if (isNum) return `<c r="${col}${ri + 1}" t="n"><v>${val}</v></c>`;
          return `<c r="${col}${ri + 1}" t="inlineStr"><is><t>${xmlEsc(val)}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Бюджет" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  const zipped = zipSync({
    "[Content_Types].xml": strToU8(types),
    "_rels/.rels": strToU8(rels),
    "xl/workbook.xml": strToU8(wb),
    "xl/_rels/workbook.xml.rels": strToU8(wbRels),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  });
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return new Blob([copy], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const INK = rgb(0.11, 0.1, 0.08);
const MUTED = rgb(0.35, 0.33, 0.3);
const LINE = rgb(0.75, 0.73, 0.68);
const ACCENT = rgb(0.12, 0.36, 0.32);

export async function budgetPdfBlob(opts: {
  settings: Settings;
  from: string;
  to: string;
  totals: BudgetTotals;
  ops: LedgerOp[];
  categories: BudgetCategory[];
  customPay: string[];
}) {
  const doc = await PDFDocument.create();
  const { regular, bold } = await embedPdfFonts(doc);
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;
  const inner = PAGE_W - M * 2;

  const line = (text: string, font: PDFFont, size: number, color = INK) => {
    if (y < M + 28) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - M;
    }
    page.drawText(text, { x: M, y, size, font, color });
    y -= size + 8;
  };

  line(opts.settings.legalName || opts.settings.clinicName || "ClinicOS", bold, 16, ACCENT);
  line("Финансовый отчёт · Бюджет", bold, 14);
  line(`${formatDate(opts.from)} — ${formatDate(opts.to)}`, regular, 10, MUTED);
  y -= 6;
  line(`Доходы: ${money(opts.totals.income)}`, regular, 11);
  line(`Расходы: ${money(opts.totals.expense)}`, regular, 11);
  line(`Прибыль: ${money(opts.totals.profit)}`, bold, 12);
  line(`Баланс: ${money(opts.totals.balance)} (начало ${money(opts.totals.opening)})`, regular, 11);
  y -= 8;
  const share = categoryShare(opts.ops, opts.categories, "expense", opts.from, opts.to);
  if (share.rows.length) {
    line("Расходы по категориям", bold, 12);
    for (const row of share.rows.slice(0, 12)) {
      line(`${row.name}: ${money(row.amount)} · ${row.pct}%`, regular, 10, MUTED);
    }
    y -= 6;
  }
  line("Операции", bold, 12);
  for (const op of opts.ops.slice(0, 40)) {
    const cat = opts.categories.find((c) => c.id === op.categoryId)?.name || "";
    const sign = op.kind === "income" ? "+" : "−";
    line(`${op.date}  ${sign}${money(op.amount)}  ${op.title}`, regular, 9);
    line(`${cat} · ${payMethodLabel(op.method, opts.customPay)}`, regular, 8, MUTED);
  }
  if (opts.ops.length > 40) line(`… ещё ${opts.ops.length - 40} операций`, regular, 9, MUTED);
  void inner;
  void LINE;
  const bytes = await doc.save();
  return pdfBlobFromBytes(bytes);
}
