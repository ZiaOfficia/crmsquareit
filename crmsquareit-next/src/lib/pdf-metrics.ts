import "server-only";
import PDFKit from "pdfkit";
import ReactPDFKit from "@react-pdf/pdfkit";

/* The Squareit quotation template (src/pdformats) was typeset with plain Helvetica metrics:
   no kerning, and greedy line breaks (fill each line, then wrap). react-pdf kerns, and its
   Knuth-Plass breaker squeezes spaces, so the same text wraps at different words.
   To match the template exactly we switch kerning off and wrap lines ourselves. */

type AFM = { glyphsForString(s: string): string[]; widthOfGlyph(g: string): number; getKernPair(l: string, r: string): number };
type Doc = new (o?: object) => { font(name: string): unknown; _font: { font: AFM } };

function afm(D: Doc, name: string): AFM {
  const d = new D({ autoFirstPage: false });
  d.font(name);
  return d._font.font;
}

// @react-pdf/font measures text with "pdfkit"; @react-pdf/renderer draws with "@react-pdf/pdfkit".
// Both share one AFM class per module, so patching one font's prototype covers every standard font.
for (const D of [PDFKit, ReactPDFKit] as unknown as Doc[]) {
  Object.getPrototypeOf(afm(D, "Helvetica")).getKernPair = () => 0;
}

/** "→" isn't in Helvetica. The template took it from the Symbol font, which react-pdf lacks,
    so we ship a one-glyph font (src/lib/fonts/arrow.ttf) with Symbol's arrow width: 0.987 em. */
export const ARROW_FONT = "SquareitArrow";
const ARROW_EM = 0.987;

export type FontName = "Helvetica" | "Helvetica-Bold" | "Helvetica-Oblique" | typeof ARROW_FONT;
const fonts = new Map<string, AFM>();
const metrics = (f: Exclude<FontName, typeof ARROW_FONT>) => {
  let m = fonts.get(f);
  if (!m) fonts.set(f, (m = afm(ReactPDFKit as unknown as Doc, f)));
  return m;
};

export function textWidth(text: string, font: FontName, size: number) {
  if (font === ARROW_FONT) return [...text].length * ARROW_EM * size;
  const m = metrics(font);
  return (m.glyphsForString(text).reduce((w, g) => w + m.widthOfGlyph(g), 0) * size) / 1000;
}

export type Run = { text: string; font: FontName };

/** Greedy word wrap of mixed-font text. Returns lines, each a list of runs. */
export function wrapRuns(runs: Run[], size: number, maxWidth: number): Run[][] {
  // Split into words, keeping the font of each piece. A "word" may span runs (e.g. "Fee." + " Rs.").
  type Piece = { text: string; font: FontName };
  const words: Piece[][] = [];
  let cur: Piece[] = [];
  for (const r of runs) {
    const parts = r.text.split(/( +)/);
    for (const p of parts) {
      if (!p) continue;
      if (/^ +$/.test(p)) {
        if (cur.length) words.push(cur);
        cur = [];
        // Keep deliberate double spaces (e.g. "•  text") as part of the next word.
        if (p.length > 1) cur.push({ text: p.slice(1), font: r.font });
      } else cur.push({ text: p, font: r.font });
    }
  }
  if (cur.length) words.push(cur);

  const wWidth = (w: Piece[]) => w.reduce((s, p) => s + textWidth(p.text, p.font, size), 0);
  const lines: Piece[][][] = [];
  let line: Piece[][] = [];
  let width = 0;
  for (const w of words) {
    const ww = wWidth(w);
    const space = line.length ? textWidth(" ", w[0].font, size) : 0;
    if (line.length && width + space + ww > maxWidth + 0.1) {
      lines.push(line);
      line = [w];
      width = ww;
    } else {
      line.push(w);
      width += space + ww;
    }
  }
  if (line.length) lines.push(line);

  // Join words back into runs, merging neighbours with the same font.
  return lines.map((ws) => {
    const out: Run[] = [];
    ws.forEach((w, i) => {
      const pieces = i ? [{ text: " ", font: w[0].font }, ...w] : w;
      for (const p of pieces) {
        const last = out[out.length - 1];
        if (last && last.font === p.font) last.text += p.text;
        else out.push({ ...p });
      }
    });
    return out;
  });
}

export const wrapText = (text: string, font: FontName, size: number, maxWidth: number) =>
  wrapRuns([{ text, font }], size, maxWidth).map((l) => l.map((r) => r.text).join(""));
