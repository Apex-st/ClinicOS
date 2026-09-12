import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { planTotals } from "./discounts";
import { formatDate, fullName, money } from "./format";
import { embedPdfFonts, pdfBlobFromBytes } from "./pdf-fonts";
import { groupPlanItems } from "./plan-groups";
import { ALL_PRIMARY_FDI, LOWER_LEFT, LOWER_RIGHT, PRIMARY_LOWER_LEFT, PRIMARY_LOWER_RIGHT, PRIMARY_UPPER_LEFT, PRIMARY_UPPER_RIGHT, TOOTH_STATUS_LABEL, UPPER_LEFT, UPPER_RIGHT, normalizeTooth } from "./teeth";
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

const TOOTH_FILL: Record<ToothStatus, ReturnType<typeof rgb>> = {
  healthy: rgb(0.957, 0.937, 0.894),
  caries: rgb(0.769, 0.361, 0.29),
  filling: rgb(0.357, 0.431, 0.478),
  pulpitis: rgb(0.608, 0.227, 0.227),
  periodontitis: rgb(0.706, 0.325, 0.035),
  crown: rgb(0.541, 0.478, 0.384),
  veneer: rgb(0.851, 0.812, 0.753),
  implant: rgb(0.122, 0.361, 0.322),
  root: rgb(0.361, 0.325, 0.282),
  missing: rgb(0.906, 0.882, 0.839),
  extracted: rgb(0.827, 0.8, 0.753),
  bridge: rgb(0.42, 0.388, 0.345),
};

function toothInk(status: ToothStatus) {
  return status === "healthy" || status === "missing" || status === "extracted" || status === "veneer"
    ? INK
    : rgb(1, 1, 1);
}

function drawOdontogram(page: PDFPage, chart: Chart, yTop: number, font: PDFFont, bold: PDFFont) {
  const inner = PAGE_W - M * 2;
  const gap = 2;
  const h = 16;
  let y = yTop;

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
        color: TOOTH_FILL[st],
        borderColor: LINE,
        borderWidth: 0.4,
      });
      if (st !== "healthy") {
        const label = TOOTH_STATUS_LABEL[st][0] ?? "";
        drawText(page, label, x + 1.5, boxY + 4, font, 6, toothInk(st));
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
    drawText(page, [...used].map((s) => TOOTH_STATUS_LABEL[s]).join(" · "), M, y, font, 7, MUTED);
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

  drawText(page, `СТОМАТОЛОГИЧЕСКАЯ КЛИНИКА «${clinic}»`, M, y, bold, 13, ACCENT);
  y -= 16;
  const extra = [settings.address, settings.phone, settings.inn ? `ИНН ${settings.inn}` : "", settings.requisites]
    .filter(Boolean)
    .join(" · ");
  if (extra) para(extra, regular, 9, MUTED);
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1, color: ACCENT });
  y -= 22;

  drawText(page, plan.title || "План лечения", M, y, bold, 16);
  y -= 20;
  const meta = [
    `Пациент: ${fullName(patient)}`,
    `Дата рождения: ${patient.birthDate ? formatDate(patient.birthDate) : "—"}`,
    `№ карты: ${patient.cardNumber || "—"}`,
    `Дата составления: ${formatDate(plan.date)}`,
    `Врач: ${plan.doctorName || settings.doctorName}`,
  ];
  for (const line of meta) {
    ensure(14);
    drawText(page, line, M, y, regular, 10);
    y -= 14;
  }
  y -= 8;

  if (chart) {
    ensure(120);
    y = drawOdontogram(page, chart, y, regular, bold);
    y -= 6;
  }

  for (const g of groups) {
    ensure(48);
    const heading = g.toothFdi != null ? `ЗУБ ${g.toothFdi}` : "ОБЩИЕ УСЛУГИ";
    drawText(page, heading, M, y, bold, 12, ACCENT);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.6, color: LINE });
    y -= 16;
    if (g.diagnosis.trim()) {
      drawText(page, "Диагноз:", M, y, bold, 10);
      y -= 13;
      para(g.diagnosis, regular, 10);
      y -= 4;
    }
    const named = g.items.filter((i) => i.serviceName.trim());
    if (named.length) {
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

  ensure(50);
  y -= 10;
  drawText(page, "Подпись врача", M, y, regular, 10);
  drawText(page, "Подпись пациента", PAGE_W / 2 + 20, y, regular, 10);
  y -= 18;
  page.drawLine({ start: { x: M, y }, end: { x: M + 160, y }, thickness: 0.8, color: INK });
  page.drawLine({ start: { x: PAGE_W / 2 + 20, y }, end: { x: PAGE_W / 2 + 180, y }, thickness: 0.8, color: INK });

  const bytes = await doc.save();
  const name = `plan-${patient.lastName || "pacient"}-${plan.date}.pdf`.replace(/\s+/g, "_");
  return { blob: pdfBlobFromBytes(bytes), name };
}
