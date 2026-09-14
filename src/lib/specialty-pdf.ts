import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDate, fullName } from "./format";
import { embedPdfFonts, pdfBlobFromBytes } from "./pdf-fonts";
import {
  APPLIANCE_TYPE,
  ARCH_CROWD,
  ARCH_DIASTEMA,
  ARCH_FORM,
  ARCH_LEN,
  ARCH_SYM,
  ARCH_TREMA,
  ARCH_WIDTH,
  BITE_SAG,
  BITE_TRANS,
  BITE_VERT,
  CONSTRUCTION_KIND,
  CONSTRUCTION_STATUS,
  DENTITION,
  FACE_CHIN,
  FACE_LIPS,
  FACE_PROFILE,
  FACE_PROP,
  FACE_SYMMETRY,
  FACE_TYPE,
  HYGIENE,
  MATERIALS,
  MUCOSA,
  OCCLUSION,
  ORTHO_ANAMNESIS,
  ORTHO_COMPLAINTS,
  ORTHO_MARKS,
  PERIO,
  PROSTHO_COMPLAINTS,
  PROSTHO_MARKS,
  RETAINER_TYPE,
  STUDY_KINDS,
  TEETH_STATE,
  TMJ,
  joinOpt,
  optLabel,
} from "./specialty";
import type { OrthoCard, Patient, ProsthoCard, Settings } from "./types";
import { pdfOn, type PdfDocId } from "./pdf-layout";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const INK = rgb(0.11, 0.1, 0.08);
const MUTED = rgb(0.35, 0.33, 0.3);
const ACCENT = rgb(0.12, 0.36, 0.32);

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const blocks = (text || "").replace(/\r\n/g, "\n").split("\n");
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
      if (font.widthOfTextAtSize(next, size) <= max) cur = next;
      else {
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

function esc(s: string) {
  return s.replace(/[&<>"]/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch,
  );
}

type Section = { id: string; title: string; body: string };

function drawDoc(
  title: string,
  patient: Patient,
  settings: Settings,
  doctorName: string,
  sections: Section[],
  docId: PdfDocId,
) {
  return async () => {
    const doc = await PDFDocument.create();
    const { regular, bold } = await embedPdfFonts(doc);
    let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - M;
    const inner = PAGE_W - M * 2;
    const on = (field: string) => pdfOn(settings, docId, field);
    const ensure = (need: number) => {
      if (y - need < M + 28) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - M;
      }
    };
    const drawText = (t: string, font: PDFFont, size: number, color = INK) => {
      page.drawText(t, { x: M, y, size, font, color });
    };
    const para = (text: string, font: PDFFont, size: number, color = INK) => {
      for (const ln of wrap(text, font, size, inner)) {
        ensure(14);
        drawText(ln, font, size, color);
        y -= 13;
      }
    };
    if (on("clinic")) {
      const clinic = settings.legalName || settings.clinicName;
      drawText(`СТОМАТОЛОГИЧЕСКАЯ КЛИНИКА «${clinic}»`, bold, 12, ACCENT);
      y -= 16;
      const extra = [settings.address, settings.phone].filter(Boolean).join(" · ");
      if (extra) {
        para(extra, regular, 9, MUTED);
        y -= 4;
      }
    }
    drawText(title, bold, 16);
    y -= 20;
    if (on("patient")) para(`Пациент: ${fullName(patient)}`, regular, 10);
    if (on("birth")) para(`Дата рождения: ${patient.birthDate ? formatDate(patient.birthDate) : "—"}`, regular, 10);
    if (on("card")) para(`№ карты: ${patient.cardNumber || "—"}`, regular, 10);
    if (on("doctor")) para(`Врач: ${doctorName}`, regular, 10);
    y -= 8;
    for (const s of sections) {
      if (!s.body.trim()) continue;
      if (!on(s.id)) continue;
      ensure(28);
      drawText(s.title, bold, 11);
      y -= 14;
      para(s.body, regular, 10);
      y -= 8;
    }
    const bytes = await doc.save();
    return { blob: pdfBlobFromBytes(bytes) };
  };
}

function marksText(marks: Record<string, string[]>, catalog: readonly (readonly [string, string])[]) {
  return Object.entries(marks)
    .filter(([, v]) => v.length)
    .map(([fdi, v]) => `${fdi}: ${v.map((id) => optLabel(catalog, id)).join(", ")}`)
    .join("\n");
}

export function orthoSections(card: OrthoCard): Section[] {
  return [
    { id: "complaints", title: "Жалобы", body: joinOpt(ORTHO_COMPLAINTS, card.complaints, card.complaintsNote) },
    { id: "anamnesis", title: "Анамнез", body: joinOpt(ORTHO_ANAMNESIS, card.anamnesis, card.anamnesisNote) },
    {
      id: "face",
      title: "Внешний осмотр",
      body: [
        card.face.symmetry && `симметрия: ${optLabel(FACE_SYMMETRY, card.face.symmetry)}`,
        card.face.profile && `профиль: ${optLabel(FACE_PROFILE, card.face.profile)}`,
        card.face.faceType && `тип: ${optLabel(FACE_TYPE, card.face.faceType)}`,
        card.face.proportions && `пропорции: ${optLabel(FACE_PROP, card.face.proportions)}`,
        card.face.lips && `губы: ${optLabel(FACE_LIPS, card.face.lips)}`,
        card.face.chin && `подбородок: ${optLabel(FACE_CHIN, card.face.chin)}`,
      ]
        .filter(Boolean)
        .join("; "),
    },
    {
      id: "oral",
      title: "Полость рта",
      body: [
        card.oral.mucosa && `слизистая: ${optLabel(MUCOSA, card.oral.mucosa)}`,
        card.oral.hygiene && `гигиена: ${optLabel(HYGIENE, card.oral.hygiene)}`,
        card.oral.teeth && `зубы: ${optLabel(TEETH_STATE, card.oral.teeth)}`,
        card.oral.periodontium && `пародонт: ${optLabel(PERIO, card.oral.periodontium)}`,
      ]
        .filter(Boolean)
        .join("; "),
    },
    {
      id: "bite",
      title: "Прикус",
      body: [
        card.dentition && optLabel(DENTITION, card.dentition),
        card.biteSagittal && `сагиттально: ${optLabel(BITE_SAG, card.biteSagittal)}`,
        card.biteVertical && `вертикально: ${optLabel(BITE_VERT, card.biteVertical)}`,
        card.biteTransverse && `трансверзально: ${optLabel(BITE_TRANS, card.biteTransverse)}`,
      ]
        .filter(Boolean)
        .join("; "),
    },
    {
      id: "arches",
      title: "Зубные ряды",
      body: [
        card.arches.form && `форма: ${optLabel(ARCH_FORM, card.arches.form)}`,
        card.arches.width && `ширина: ${optLabel(ARCH_WIDTH, card.arches.width)}`,
        card.arches.length && `длина: ${optLabel(ARCH_LEN, card.arches.length)}`,
        card.arches.crowding && `скученность: ${optLabel(ARCH_CROWD, card.arches.crowding)}`,
        card.arches.trema && `тремы: ${optLabel(ARCH_TREMA, card.arches.trema)}`,
        card.arches.diastema && `диастема: ${optLabel(ARCH_DIASTEMA, card.arches.diastema)}`,
        card.arches.symmetry && `симметрия: ${optLabel(ARCH_SYM, card.arches.symmetry)}`,
      ]
        .filter(Boolean)
        .join("; "),
    },
    { id: "teeth", title: "Зубы", body: marksText(card.teethMarks, ORTHO_MARKS) },
    {
      id: "measurements",
      title: "Измерения",
      body: card.measurements
        .filter((m) => m.value.trim())
        .map((m) => `${m.name}: ${m.value} ${m.unit}`)
        .join("\n"),
    },
    {
      id: "studies",
      title: "Диагностика",
      body: card.studies
        .map((s) => `${s.date} ${optLabel(STUDY_KINDS, s.kind)}${s.conclusion ? ` — ${s.conclusion}` : ""}`)
        .join("\n"),
    },
    { id: "diagnosis", title: "Диагноз", body: card.diagnosisText },
    {
      id: "plan",
      title: "План",
      body: [card.plan.goal, card.plan.method, card.plan.appliance, card.plan.stages, card.plan.duration, card.plan.notes]
        .filter(Boolean)
        .join("\n"),
    },
    {
      id: "appliance",
      title: "Аппарат",
      body: [optLabel(APPLIANCE_TYPE, card.appliance.type), card.appliance.system, card.appliance.installedOn, card.appliance.notes]
        .filter((x) => x && x !== "—")
        .join("; "),
    },
    {
      id: "visits",
      title: "Дневник",
      body: card.visits
        .map((v) => `${v.date} ${v.time} ${v.actions || v.complaints || v.notes}`.trim())
        .join("\n"),
    },
    {
      id: "retention",
      title: "Ретенция",
      body: [card.retention.activeEnd, optLabel(RETAINER_TYPE, card.retention.retainerType), card.retention.notes]
        .filter((x) => x && x !== "—")
        .join("; "),
    },
    { id: "epicrisis", title: "Эпикриз", body: card.epicrisis },
  ];
}

export function prosthoSections(card: ProsthoCard): Section[] {
  return [
    { id: "complaints", title: "Жалобы", body: joinOpt(PROSTHO_COMPLAINTS, card.complaints, card.complaintsNote) },
    { id: "anamnesis", title: "Анамнез", body: card.anamnesis },
    { id: "exam", title: "Осмотр", body: card.exam },
    {
      id: "occlusion",
      title: "Окклюзия / ВНЧС",
      body: [card.occlusion && optLabel(OCCLUSION, card.occlusion), card.tmj && optLabel(TMJ, card.tmj)]
        .filter(Boolean)
        .join("; "),
    },
    { id: "teeth", title: "Зубы", body: marksText(card.teethMarks, PROSTHO_MARKS) },
    { id: "diagnosis", title: "Диагноз", body: card.diagnosisText },
    { id: "plan", title: "План", body: card.planNotes },
    {
      id: "constructions",
      title: "Конструкции",
      body: card.constructions
        .map((c) => {
          const teeth = c.teeth.length ? `зубы ${c.teeth.join(", ")}` : "";
          return [
            optLabel(CONSTRUCTION_KIND, c.kind),
            teeth,
            optLabel(MATERIALS, c.material) === "—" ? c.material : optLabel(MATERIALS, c.material),
            c.color === "other" ? c.colorOther || "другой цвет" : c.color,
            optLabel(CONSTRUCTION_STATUS, c.status),
            c.price ? `${c.price} ₽` : "",
          ]
            .filter(Boolean)
            .join(" · ");
        })
        .join("\n"),
    },
    {
      id: "visits",
      title: "Дневник",
      body: card.visits.map((v) => `${v.date} ${v.time} ${v.actions || v.notes}`.trim()).join("\n"),
    },
    { id: "result", title: "Результат", body: card.result },
  ];
}

export async function buildOrthoPdfBlob(card: OrthoCard, patient: Patient, settings: Settings, doctorName: string) {
  const built = await drawDoc("Ортодонтическая карта", patient, settings, doctorName, orthoSections(card), "ortho")();
  const name = `ortho-${patient.lastName || "pacient"}.pdf`.replace(/\s+/g, "_");
  return { ...built, name };
}

export async function buildProsthoPdfBlob(card: ProsthoCard, patient: Patient, settings: Settings, doctorName: string) {
  const built = await drawDoc("Ортопедическая карта", patient, settings, doctorName, prosthoSections(card), "prostho")();
  const name = `prostho-${patient.lastName || "pacient"}.pdf`.replace(/\s+/g, "_");
  return { ...built, name };
}

export function specialtyHtml(
  title: string,
  patient: Patient,
  settings: Settings,
  doctorName: string,
  sections: Section[],
  docId: PdfDocId,
) {
  const on = (field: string) => pdfOn(settings, docId, field);
  const clinic = esc(settings.legalName || settings.clinicName);
  const blocks = sections
    .filter((s) => s.body.trim() && on(s.id))
    .map((s) => `<section><h2>${esc(s.title)}</h2><p>${esc(s.body).replace(/\n/g, "<br/>")}</p></section>`)
    .join("");
  const head = on("clinic")
    ? `<h1>СТОМАТОЛОГИЧЕСКАЯ КЛИНИКА «${clinic}»</h1>`
    : `<h1>${esc(title)}</h1>`;
  const metaBits = [
    on("patient") ? esc(fullName(patient)) : "",
    on("card") ? `карта ${esc(patient.cardNumber || "—")}` : "",
    on("doctor") ? esc(doctorName) : "",
  ].filter(Boolean);
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>body{font-family:"Times New Roman",serif;color:#1c1915;margin:16mm}h1{font-size:20px;text-align:center}h2{font-size:14px;font-weight:700;margin:16px 0 6px}p{margin:0 0 6px;font-size:13px}.muted{color:#555}</style>
</head><body>
${head}
${metaBits.length ? `<p class="muted">${metaBits.join(" · ")}</p>` : ""}
${blocks}
</body></html>`;
}
