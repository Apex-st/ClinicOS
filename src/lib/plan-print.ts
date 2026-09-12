import { planTotals } from "./discounts";
import { formatDate, fullName, money } from "./format";
import { groupPlanItems, planDocumentText } from "./plan-groups";
import { ALL_PRIMARY_FDI, LOWER_LEFT, LOWER_RIGHT, PRIMARY_LOWER_LEFT, PRIMARY_LOWER_RIGHT, PRIMARY_UPPER_LEFT, PRIMARY_UPPER_RIGHT, TOOTH_STATUS_LABEL, UPPER_LEFT, UPPER_RIGHT, normalizeTooth } from "./teeth";
import type { Chart, DiscountType, Patient, Settings, ToothStatus, TreatmentPlan } from "./types";

function esc(s: string) {
  return s.replace(/[&<>"]/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    return "&" + "quot;";
  });
}

const TOOTH_HEX: Record<ToothStatus, string> = {
  healthy: "#f4efe4",
  caries: "#c45c4a",
  filling: "#5b6e7a",
  pulpitis: "#9b3a3a",
  periodontitis: "#b45309",
  crown: "#8a7a62",
  veneer: "#d9cfc0",
  implant: "#1f5c52",
  root: "#5c5348",
  missing: "#e7e1d6",
  extracted: "#d3ccc0",
  bridge: "#6b6358",
};

function formulaHtml(chart: Chart) {
  const row = (fdis: readonly number[], numbers: "top" | "bottom") => {
    const cells = fdis
      .map((fdi) => {
        const st = normalizeTooth(chart[fdi]).status;
        const ink = st === "healthy" || st === "missing" || st === "extracted" || st === "veneer" ? "#1c1915" : "#fff";
        const box = `<div class="box" style="background:${TOOTH_HEX[st]};color:${ink}">${st === "healthy" ? "" : TOOTH_STATUS_LABEL[st][0]}</div>`;
        const n = `<div class="n">${fdi}</div>`;
        return `<div class="tth">${numbers === "top" ? n + box : box + n}</div>`;
      })
      .join("");
    return `<div class="arch">${cells}</div>`;
  };
  const used = new Set<ToothStatus>();
  const allFdi = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_RIGHT, ...LOWER_LEFT, ...ALL_PRIMARY_FDI];
  for (const fdi of allFdi) {
    const st = normalizeTooth(chart[fdi]).status;
    if (st !== "healthy") used.add(st);
  }
  const legend = used.size
    ? `<p class="muted">${[...used].map((s) => TOOTH_STATUS_LABEL[s]).join(" · ")}</p>`
    : "";
  const primaryUsed = ALL_PRIMARY_FDI.some((fdi) => normalizeTooth(chart[fdi]).status !== "healthy");
  const primaryBlock = primaryUsed
    ? `<h3>Молочный прикус</h3>${row([...PRIMARY_UPPER_RIGHT, ...PRIMARY_UPPER_LEFT], "top")}${row([...PRIMARY_LOWER_RIGHT, ...PRIMARY_LOWER_LEFT], "bottom")}`
    : "";
  return `<div class="formula"><h2>Зубная формула</h2>${row([...UPPER_RIGHT, ...UPPER_LEFT], "top")}${row([...LOWER_RIGHT, ...LOWER_LEFT], "bottom")}${primaryBlock}${legend}</div>`;
}

export function planDocumentHtml(
  plan: TreatmentPlan,
  patient: Patient,
  settings: Settings,
  discounts: DiscountType[],
  chart?: Chart,
) {
  const dtype = discounts.find((d) => d.id === plan.discountTypeId);
  const totals = planTotals(plan.items, plan.discount);
  const clinic = esc(settings.legalName || settings.clinicName);
  const groups = groupPlanItems(plan.items);

  const extra = [
    settings.address && `Адрес: ${esc(settings.address)}`,
    settings.phone && `Тел.: ${esc(settings.phone)}`,
    settings.inn && `ИНН: ${esc(settings.inn)}`,
    settings.requisites && esc(settings.requisites),
  ]
    .filter(Boolean)
    .join(" · ");

  const blocks = groups
    .map((g) => {
      const named = g.items.filter((i) => i.serviceName.trim());
      const rows = named
        .map((it, i) => {
          const sum = Math.max(0, it.price * it.qty - it.discount);
          return `<tr>
            <td>${i + 1}</td>
            <td>${esc(it.serviceName)}</td>
            <td class="num">${it.qty}</td>
            <td class="num">${money(it.price)}</td>
            <td class="num">${it.discount ? money(it.discount) : "—"}</td>
            <td class="num">${money(sum)}</td>
          </tr>`;
        })
        .join("");
      const title = g.toothFdi != null ? `Зуб ${g.toothFdi}` : "Общие услуги";
      return `<section class="tooth">
        <h2>${title}</h2>
        ${g.diagnosis ? `<p><b>Диагноз:</b> ${esc(g.diagnosis)}</p>` : ""}
        ${
          named.length
            ? `<table class="grid">
          <thead><tr><th>№</th><th>Услуга</th><th>Кол-во</th><th>Цена</th><th>Скидка</th><th>Итог</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="tooth-sum">Стоимость: ${money(g.subtotal)}</p>`
            : ""
        }
      </section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<title>План лечения — ${esc(fullName(patient))}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Times, serif; color: #1c1915; margin: 0; }
  h1 { font-size: 20px; letter-spacing: .08em; text-align: center; margin: 0; }
  h2 { font-size: 15px; margin: 18px 0 8px; border-bottom: 1px solid #222; padding-bottom: 4px; }
  .sub { text-align: center; font-size: 12px; margin: 6px 0 18px; color: #444; }
  .meta { width: 100%; font-size: 13px; margin-bottom: 8px; }
  .meta td { padding: 3px 8px 3px 0; vertical-align: top; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  table.grid th, table.grid td { border: 1px solid #222; padding: 6px 7px; }
  table.grid th { background: #f3f0ea; text-align: left; font-weight: 600; }
  .num { text-align: right; white-space: nowrap; }
  .tooth-sum { text-align: right; font-weight: 700; margin: 6px 0 0; }
  .totals { width: 280px; margin-left: auto; margin-top: 16px; font-size: 13px; }
  .totals td { padding: 3px 0; }
  .totals .sum { font-size: 16px; font-weight: 700; }
  .block { margin-top: 16px; font-size: 13px; }
  .sign { margin-top: 36px; display: flex; justify-content: space-between; font-size: 13px; }
  .line { display: inline-block; min-width: 180px; border-bottom: 1px solid #222; }
  .muted { color: #555; font-size: 12px; }
  .formula { margin: 12px 0 18px; }
  .formula h2 { margin-top: 0; }
  .arch { display: flex; gap: 2px; justify-content: center; margin: 4px 0; }
  .tth { width: 28px; text-align: center; font-size: 9px; }
  .tth .box { height: 18px; border: 1px solid #888; border-radius: 3px; line-height: 18px; }
  .tth .n { color: #555; }
</style>
</head>
<body>
  <h1>СТОМАТОЛОГИЧЕСКАЯ КЛИНИКА «${clinic}»</h1>
  <p class="sub">${extra || "Один кабинет"}</p>
  <table class="meta">
    <tr><td>Пациент:</td><td><b>${esc(fullName(patient))}</b></td><td>Дата составления:</td><td>${formatDate(plan.date)}</td></tr>
    <tr><td>Дата рождения:</td><td>${patient.birthDate ? formatDate(patient.birthDate) : "—"}</td><td>Врач:</td><td>${esc(plan.doctorName || settings.doctorName)}</td></tr>
    <tr><td>№ медицинской карты:</td><td>${esc(patient.cardNumber || patient.id)}</td><td>Документ:</td><td>${esc(plan.title)}</td></tr>
  </table>
  ${chart ? formulaHtml(chart) : ""}
  ${blocks}
  <table class="totals">
    <tr><td>Стоимость без скидки</td><td class="num">${money(totals.subtotal)}</td></tr>
    <tr><td>Скидки в строках</td><td class="num">${totals.lineDiscount ? "−" + money(totals.lineDiscount) : "—"}</td></tr>
    <tr><td>Скидка плана${dtype ? ` «${esc(dtype.name)}»` : ""}</td><td class="num">${totals.planDiscount ? "−" + money(totals.planDiscount) : "—"}</td></tr>
    <tr class="sum"><td>Итого к оплате</td><td class="num">${money(totals.total)}</td></tr>
  </table>
  <div class="sign">
    <div>Подпись врача<br/><span class="line"></span></div>
    <div>Подпись пациента<br/><span class="line"></span></div>
  </div>
  <p class="muted" style="margin-top:24px">Документ сформирован в программе кабинета. Не является публичной офертой.</p>
</body>
</html>`;
}

export function openPlanPrint(
  plan: TreatmentPlan,
  patient: Patient,
  settings: Settings,
  discounts: DiscountType[],
  chart?: Chart,
) {
  const html = planDocumentHtml(plan, patient, settings, discounts, chart);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Печать плана лечения");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const start = () => {
    try {
      win.focus();
      win.print();
    } catch {
      iframe.remove();
      return;
    }
    window.setTimeout(() => iframe.remove(), 60_000);
  };
  if (doc.readyState === "complete") window.setTimeout(start, 120);
  else iframe.onload = () => window.setTimeout(start, 120);
  return true;
}

export function planShareText(plan: TreatmentPlan, patient: Patient, settings: Settings) {
  return planDocumentText(plan, patient, settings);
}
