import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { diarySections, VISIT_KIND_LABEL } from "./diary";
import { formatDate, fullName, money } from "./format";
import { embedPdfFonts, pdfBlobFromBytes } from "./pdf-fonts";
import type {
  DiaryExtras,
  Patient,
  Service,
  Settings,
  StockItem,
  VisitDiary,
  VisitItem,
  VisitKind,
} from "./types";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const INK = rgb(0.11, 0.1, 0.08);
const MUTED = rgb(0.35, 0.33, 0.3);
const LINE = rgb(0.75, 0.73, 0.68);
const ACCENT = rgb(0.12, 0.36, 0.32);

export type DiaryPdfInput = {
  patient: Patient;
  settings: Settings;
  date: string;
  doctorName: string;
  kind: VisitKind;
  diary: VisitDiary;
  extras?: DiaryExtras;
  stockItems?: StockItem[];
  services?: Service[];
  items?: VisitItem[];
  discount?: number;
  paid?: number;
  total?: number;
};

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const blocks = (text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const block of blocks) {
    const clean = block.replace(/[ \t]+/g, " ").trimEnd();
    if (!clean.trim()) {
      if (lines.length) lines.push("");
      continue;
    }
    const words = clean.trimStart().split(" ");
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= max) {
        cur = next;
      } else {
        if (cur) lines.push(cur);
        cur = w;
        while (font.widthOfTextAtSize(cur, size) > max && cur.length > 1) {
          let cut = cur.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(cur.slice(0, cut) + "…", size) > max) cut--;
          lines.push(cur.slice(0, cut) + "…");
          cur = cur.slice(cut);
        }
      }
    }
    if (cur) lines.push(cur);
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = INK) {
  page.drawText(text, { x, y, size, font, color });
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    return "&" + "quot;";
  });
}

export function diaryDocumentHtml(input: DiaryPdfInput) {
  const clinic = esc(input.settings.legalName || input.settings.clinicName);
  const extra = [
    input.settings.address && `Адрес: ${esc(input.settings.address)}`,
    input.settings.phone && `Тел.: ${esc(input.settings.phone)}`,
    input.settings.inn && `ИНН: ${esc(input.settings.inn)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const sections = diarySections(input.kind, input.diary, input.extras, input.stockItems);
  const blocks = sections
    .map(
      (s) =>
        `<section class="sec"><h2>${esc(s.title)}</h2><p>${esc(s.body).replace(/\n/g, "<br/>")}</p></section>`,
    )
    .join("");
  const named = (input.items ?? []).filter((i) => i.serviceId);
  const svcRows = named
    .map((it, i) => {
      const name = input.services?.find((s) => s.id === it.serviceId)?.name ?? "Услуга";
      const sum = it.price * it.qty;
      const tooth = it.toothFdi ? ` · зуб ${it.toothFdi}` : "";
      return `<tr><td>${i + 1}</td><td>${esc(name)}${tooth}</td><td class="num">${it.qty}</td><td class="num">${money(it.price)}</td><td class="num">${money(sum)}</td></tr>`;
    })
    .join("");
  const pay =
    named.length || input.total
      ? `<h2>Услуги</h2>
        ${
          named.length
            ? `<table class="grid"><thead><tr><th>№</th><th>Услуга</th><th>Кол-во</th><th>Цена</th><th>Итог</th></tr></thead><tbody>${svcRows}</tbody></table>`
            : ""
        }
        <table class="totals">
          <tr><td>К оплате</td><td class="num">${money(input.total ?? 0)}</td></tr>
          <tr><td>Оплачено</td><td class="num">${money(input.paid ?? 0)}</td></tr>
        </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<title>Дневник посещения — ${esc(fullName(input.patient))}</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: "Times New Roman", Times, serif; color: #1c1915; margin: 0; }
  h1 { font-size: 20px; letter-spacing: .08em; text-align: center; margin: 0; }
  h2 { font-size: 14px; font-weight: 700; margin: 16px 0 6px; }
  .sub { text-align: center; font-size: 12px; margin: 6px 0 16px; color: #444; }
  .meta { width: 100%; font-size: 13px; margin-bottom: 8px; }
  .meta td { padding: 3px 8px 3px 0; }
  .sec p { font-size: 13px; margin: 0 0 4px; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  table.grid th, table.grid td { border: 1px solid #222; padding: 6px 7px; }
  table.grid th { text-align: left; font-weight: 700; }
  .num { text-align: right; }
  .totals { width: 260px; margin-left: auto; margin-top: 12px; font-size: 13px; }
  .sign { margin-top: 36px; display: flex; justify-content: space-between; font-size: 13px; }
  .line { display: inline-block; min-width: 180px; border-bottom: 1px solid #222; }
  .muted { color: #555; font-size: 12px; }
</style>
</head>
<body>
  <h1>СТОМАТОЛОГИЧЕСКАЯ КЛИНИКА «${clinic}»</h1>
  <p class="sub">${extra || "Дневник посещения"}</p>
  <table class="meta">
    <tr><td>Пациент:</td><td><b>${esc(fullName(input.patient))}</b></td><td>Дата:</td><td>${formatDate(input.date)}</td></tr>
    <tr><td>№ карты:</td><td>${esc(input.patient.cardNumber || "—")}</td><td>Врач:</td><td>${esc(input.doctorName)}</td></tr>
    <tr><td>Тип приёма:</td><td>${esc(VISIT_KIND_LABEL[input.kind])}</td><td>Документ:</td><td>Дневник посещения</td></tr>
  </table>
  ${blocks}
  ${pay}
  <div class="sign">
    <div>Подпись врача<br/><span class="line"></span></div>
    <div>Подпись пациента<br/><span class="line"></span></div>
  </div>
  <p class="muted" style="margin-top:24px">Документ сформирован в программе кабинета.</p>
</body>
</html>`;
}

export async function buildDiaryPdfBlob(input: DiaryPdfInput) {
  const doc = await PDFDocument.create();
  const { regular, bold } = await embedPdfFonts(doc);
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;
  const inner = PAGE_W - M * 2;

  const ensure = (need: number) => {
    if (y - need < M + 28) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - M;
    }
  };
  const para = (text: string, font: PDFFont, size: number, color = INK) => {
    for (const ln of wrap(text, font, size, inner)) {
      ensure(14);
      drawText(page, ln, M, y, font, size, color);
      y -= 13;
    }
  };

  const clinic = input.settings.legalName || input.settings.clinicName;
  drawText(page, `СТОМАТОЛОГИЧЕСКАЯ КЛИНИКА «${clinic}»`, M, y, bold, 13, ACCENT);
  y -= 16;
  const extra = [input.settings.address, input.settings.phone, input.settings.inn ? `ИНН ${input.settings.inn}` : ""]
    .filter(Boolean)
    .join(" · ");
  if (extra) para(extra, regular, 9, MUTED);
  y -= 4;
  page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1, color: ACCENT });
  y -= 22;
  drawText(page, "Дневник посещения", M, y, bold, 16);
  y -= 20;

  const meta = [
    `Пациент: ${fullName(input.patient)}`,
    `Дата рождения: ${input.patient.birthDate ? formatDate(input.patient.birthDate) : "—"}`,
    `№ карты: ${input.patient.cardNumber || "—"}`,
    `Дата приёма: ${formatDate(input.date)}`,
    `Врач: ${input.doctorName}`,
    `Тип приёма: ${VISIT_KIND_LABEL[input.kind]}`,
  ];
  for (const line of meta) {
    ensure(14);
    drawText(page, line, M, y, regular, 10);
    y -= 14;
  }
  y -= 6;

  for (const s of diarySections(input.kind, input.diary, input.extras, input.stockItems)) {
    ensure(28);
    drawText(page, s.title, M, y, bold, 11);
    y -= 14;
    para(s.body, regular, 10);
    y -= 8;
  }

  const named = (input.items ?? []).filter((i) => i.serviceId);
  if (named.length) {
    ensure(36);
    drawText(page, "Услуги", M, y, bold, 11);
    y -= 16;
    for (const [i, it] of named.entries()) {
      const name = input.services?.find((s) => s.id === it.serviceId)?.name ?? "Услуга";
      const tooth = it.toothFdi ? ` (зуб ${it.toothFdi})` : "";
      const line = `${i + 1}. ${name}${tooth} × ${it.qty} — ${money(it.price * it.qty)}`;
      para(line, regular, 10);
    }
    y -= 4;
  }
  if (input.total != null) {
    ensure(28);
    const due = `К оплате: ${money(input.total)} · оплачено: ${money(input.paid ?? 0)}`;
    drawText(page, due, M, y, bold, 10);
    y -= 18;
  }

  ensure(50);
  y -= 8;
  drawText(page, "Подпись врача", M, y, regular, 10);
  drawText(page, "Подпись пациента", PAGE_W / 2 + 20, y, regular, 10);
  y -= 18;
  page.drawLine({ start: { x: M, y }, end: { x: M + 160, y }, thickness: 0.8, color: LINE });
  page.drawLine({ start: { x: PAGE_W / 2 + 20, y }, end: { x: PAGE_W / 2 + 180, y }, thickness: 0.8, color: LINE });

  const bytes = await doc.save();
  const name = `diary-${input.patient.lastName || "pacient"}-${input.date}.pdf`.replace(/\s+/g, "_");
  return { blob: pdfBlobFromBytes(bytes), name };
}
