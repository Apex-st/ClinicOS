const VOWELS = /[аеёиоуыэюяaeiouy]/i;
const KEEP = /[ьъй]/i;

/** Разбивает русскую (и латинскую) фамилию на слоги: Иванова → И-ва-но-ва. */
export function splitSyllables(text: string): string[] {
  const raw = text.trim();
  if (!raw) return ["Пациент"];
  const chunks = raw.split(/[-–—\s]+/).filter(Boolean);
  const out: string[] = [];
  for (const chunk of chunks) out.push(...syllabifyWord(chunk));
  return out.length ? out : [raw];
}

function syllabifyWord(word: string): string[] {
  if (word.length <= 2) return [word];
  const chars = [...word];
  const vowels: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (VOWELS.test(chars[i]!)) vowels.push(i);
  }
  if (vowels.length <= 1) return [word];

  const cuts: number[] = [];
  for (let k = 0; k < vowels.length - 1; k++) {
    const v = vowels[k]!;
    const nv = vowels[k + 1]!;
    let i = v + 1;
    while (i < nv && KEEP.test(chars[i]!)) i++;
    const clusterStart = i;
    const clusterLen = nv - clusterStart;
    if (clusterLen <= 1) {
      cuts.push(clusterStart);
    } else {
      let cut = clusterStart + 1;
      while (cut < nv && KEEP.test(chars[cut]!)) cut++;
      cuts.push(cut);
    }
  }

  const parts: string[] = [];
  let start = 0;
  for (const cut of cuts) {
    if (cut > start) parts.push(chars.slice(start, cut).join(""));
    start = cut;
  }
  if (start < chars.length) parts.push(chars.slice(start).join(""));
  return parts.filter(Boolean);
}
