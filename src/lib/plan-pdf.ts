import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { planTotals } from "./discounts";
import { formatDate, fullName, money } from "./format";
import { embedPdfFonts, pdfBlobFromBytes } from "./pdf-fonts";
import { groupPlanItems } from "./plan-groups";
import { pdfOn } from "./pdf-layout";
import { ALL_PRIMARY_FDI, LOWER_LEFT, LOWER_RIGHT, PRIMARY_LOWER_LEFT, PRIMARY_LOWER_RIGHT, PRIMARY_UPPER_LEFT, PRIMARY_UPPER_RIGHT, UPPER_LEFT, UPPER_RIGHT, normalizeTooth, toothStatusColor, toothStatusLabel } from "./teeth";
import type { Chart, DiscountType, Patient, Settings, ToothStatus, TreatmentPlan } from "./types";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const INK = rgb(0.11, 0.1, 0.08);
const MUTED = rgb(0.35, 0.33, 0.3);
const LINE = rgb(0.75, 0.73, 0.68);
const HEAD = rgb(0.95, 0.94, 0.9);
const ACCENT = rgb(0.12, 0.36, 0.32);

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

function hexRgb(hex: string) {
  const raw = hex.replace("#", "");
  const h = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = Number.parseInt(h, 16);
  if (!Number.isFinite(n)) return rgb(0.95, 0.94, 0.9);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function toothInk(status: ToothStatus, settings?: Settings) {
  const hex = toothStatusColor(status, settings?.toothStatuses);
  const raw = hex.replace("#", "");
  const h = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = Number.parseInt(h, 16);
  if (!Number.isFinite(n)) return INK;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 158 ? INK : rgb(1, 1, 1);
}

function drawOdontogram(page: PDFPage, chart: Chart, yTop: number, font: PDFFont, bold: PDFFont, settings?: Settings) {
  const inner = PAGE_W - M * 2;
  const gap = 2;
  const h = 16;
  let y = yTop;
  const saved = settings?.toothStatuses;

  drawText(page, "Зубная формула", M, y, bold, 10);
  y -= 14;

  const row = (fdis: readonly number[], numbersAbove: boolean) => {
    const n = Math.max(fdis.length, 1);
    const cell = (inner - gap * (n - 1)) / n;
    fdis.forEach((fdi, i) => {
      const st = normalizeTooth(chart[fdi]).status;
      const x = M + i * (cell + gap);
      const numY = numbersAbove ? y : y - h - 9;
      const boxY = numbersAbove ? y - 11 - h : y - h;
      drawText(page, String(fdi), x + Math.max(0, (cell - font.widthOfTextAtSize(String(fdi), 6)) / 2), numY, font, 6, MUTED);
      page.drawRectangle({
        x,
        y: boxY,
        width: cell,
        height: h,
        color: hexRgb(toothStatusColor(st, saved)),
        borderColor: LINE,
        borderWidth: 0.4,
      });
      if (st !== "healthy") {
        const label = toothStatusLabel(st, saved)[0] ?? "";
        drawText(page, label, x + 1.5, boxY + 4, font, 6, toothInk(st, settings));
      }
    });
    return numbersAbove ? y - 11 - h - 4 : y - h - 12;
  };

  y = row([...UPPER_RIGHT, ...UPPER_LEFT], true);
  y -= 6;
  y = row([...LOWER_RIGHT, ...LOWER_LEFT], false);

  const primaryUsed = ALL_PRIMARY_FDI.some((fdi) => normalizeTooth(chart[fdi]).status !== "healthy");
  if (primaryUsed) {
    y -= 4;
    drawText(page, "Молочный прикус", M, y, bold, 9);
    y -= 12;
    y = row([...PRIMARY_UPPER_RIGHT, ...PRIMARY_UPPER_LEFT], true);
    y -= 6;
    y = row([...PRIMARY_LOWER_RIGHT, ...PRIMARY_LOWER_LEFT], false);
  }

  const used = new Set<ToothStatus>();
  for (const fdi of [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_RIGHT, ...LOWER_LEFT, ...ALL_PRIMARY_FDI]) {
    const st = normalizeTooth(chart[fdi]).status;
    if (st !== "healthy") used.add(st);
  }
  if (used.size) {
    y -= 4;
    drawText(page, [...used].map((s) => toothStatusLabel(s, saved)).join(" · "), M, y, font, 7, MUTED);
    y -= 12;
  } else {
    y -= 6;
  }
  return y;
}

export async function buildPlanPdfBlob(
  plan: TreatmentPlan,
  patient: Patient,
  settings: Settings,
  discounts: DiscountType[],
  chart?: Chart,
) {
  const doc = await PDFDocument.create();
  const { regular, bold } = await embedPdfFonts(doc);
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;
  const inner = PAGE_W - M * 2;

  const dtype = discounts.find((d) => d.id === plan.discountTypeId);
  const totals = planTotals(plan.items, plan.discount);
  const groups = groupPlanItems(plan.items);
  const clinic = settings.legalName || settings.clinicName;
  const on = (field: string) => pdfOn(settings, "plan", field);

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

  if (on("clinic")) {
    drawText(page, `СТОМАТОЛОГИЧЕСКАЯ КЛИНИКА «${clinic}»`, M, y, bold, 13, ACCENT);
    y -= 16;
    const extra = [settings.address, settings.phone, settings.inn ? `ИНН ${settings.inn}` : "", settings.requisites]
      .filter(Boolean)
      .join(" · ");
    if (extra) para(extra, regular, 9, MUTED);
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1, color: ACCENT });
    y -= 22;
  }

  drawText(page, plan.title || "План лечения", M, y, bold, 16);
  y -= 20;
  const meta: string[] = [];
  if (on("patient")) meta.push(`Пациент: ${fullName(patient)}`);
  if (on("birth")) meta.push(`Дата рождения: ${patient.birthDate ? formatDate(patient.birthDate) : "—"}`);
  if (on("card")) meta.push(`№ карты: ${patient.cardNumber || "—"}`);
  if (on("date")) meta.push(`Дата составления: ${formatDate(plan.date)}`);
  if (on("doctor")) meta.push(`Врач: ${plan.doctorName || settings.doctorName}`);
  for (const line of meta) {
    ensure(14);
    drawText(page, line, M, y, regular, 10);
    y -= 14;
  }
  y -= 8;

  if (chart && on("odontogram")) {
    ensure(120);
    y = drawOdontogram(page, chart, y, regular, bold, settings);
    y -= 6;
  }

  for (const g of groups) {
    const named = g.items.filter((i) => i.serviceName.trim());
    const showDx = on("diagnosis") && g.diagnosis.trim();
    const showItems = on("groups") && named.length;
    if (!showDx && !showItems) continue;
    ensure(48);
    const heading = g.toothFdi != null ? `ЗУБ ${g.toothFdi}` : "ОБЩИЕ УСЛУГИ";
    drawText(page, heading, M, y, bold, 12, ACCENT);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.6, color: LINE });
    y -= 16;
    if (showDx) {
      drawText(page, "Диагноз:", M, y, bold, 10);
      y -= 13;
      para(g.diagnosis, regular, 10);
      y -= 4;
    }
    if (showItems) {
      ensure(28);
      drawText(page, g.toothFdi != null ? "Услуги:" : "Список:", M, y, bold, 10);
      y -= 14;
      const cols = [
        { w: 24, label: "№" },
        { w: 250, label: "Услуга" },
        { w: 36, label: "Кол." },
        { w: 70, label: "Цена" },
        { w: 70, label: "Итог" },
      ];
      const tableW = cols.reduce((s, c) => s + c.w, 0);
      ensure(22);
      page.drawRectangle({ x: M, y: y - 12, width: tableW, height: 16, color: HEAD });
      let hx = M;
      cols.forEach((c) => {
        drawText(page, c.label, hx + 3, y - 8, bold, 8);
        hx += c.w;
      });
      y -= 18;
      named.forEach((it, i) => {
        const sum = Math.max(0, it.price * it.qty - it.discount);
        const nameLines = wrap(it.serviceName || "—", regular, 9, cols[1]!.w - 6);
        const rh = Math.max(14, nameLines.length * 11 + 6);
        ensure(rh + 4);
        const cells = [String(i + 1), "", String(it.qty), money(it.price), money(sum)];
        let cx = M;
        cells.forEach((val, idx) => {
          if (idx === 1) {
            nameLines.forEach((ln, li) => drawText(page, ln, cx + 3, y - 6 - li * 11, regular, 9));
          } else {
            const right = idx >= 2;
            const tw = regular.widthOfTextAtSize(val, 9);
            const x = right ? cx + cols[idx]!.w - 4 - tw : cx + 3;
            drawText(page, val, x, y - 6, regular, 9);
          }
          cx += cols[idx]!.w;
        });
        y -= rh;
      });
      ensure(16);
      const cost = `Стоимость: ${money(g.subtotal)}`;
      drawText(page, cost, PAGE_W - M - bold.widthOfTextAtSize(cost, 10), y, bold, 10);
      y -= 18;
    }
  }

  y -= 6;
  if (on("totals")) {
    ensure(80);
    const totalsX = PAGE_W - M - 220;
    const rows: Array<[string, string]> = [
      ["Стоимость без скидки", money(totals.subtotal)],
      ["Скидки в строках", totals.lineDiscount ? `−${money(totals.lineDiscount)}` : "—"],
      [`Скидка плана${dtype ? ` «${dtype.name}»` : ""}`, totals.planDiscount ? `−${money(totals.planDiscount)}` : "—"],
    ];
    for (const [l, v] of rows) {
      drawText(page, l, totalsX, y, regular, 10);
      drawText(page, v, PAGE_W - M - regular.widthOfTextAtSize(v, 10), y, regular, 10);
      y -= 14;
    }
    drawText(page, "ИТОГО", totalsX, y, bold, 12);
    drawText(page, money(totals.total), PAGE_W - M - bold.widthOfTextAtSize(money(totals.total), 12), y, bold, 12, ACCENT);
    y -= 24;
  }

  if (on("signatures")) {
    ensure(50);
    y -= 10;
    drawText(page, "Подпись врача", M, y, regular, 10);
    drawText(page, "Подпись пациента", PAGE_W / 2 + 20, y, regular, 10);
    y -= 18;
    page.drawLine({ start: { x: M, y }, end: { x: M + 160, y }, thickness: 0.8, color: INK });
    page.drawLine({ start: { x: PAGE_W / 2 + 20, y }, end: { x: PAGE_W / 2 + 180, y }, thickness: 0.8, color: INK });
  }

  const bytes = await doc.save();
  const name = `plan-${patient.lastName || "pacient"}-${plan.date}.pdf`.replace(/\s+/g, "_");
  return { blob: pdfBlobFromBytes(bytes), name };
}
