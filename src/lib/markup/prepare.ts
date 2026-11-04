// Ported from the web app (frontend/src/lib/markup/tags.ts). Instead of turning [[key]]/[[note]]/[[warn]] and the
// model's styled <div> blocks into raw HTML, this splits the reply into segments the phone renders natively. Code is
// masked first so tags inside fences or inline code stay literal.
const CODE = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?(?:\n\2[^\n]*(?=\n|$)|$)|`+[^`\n]+`+/g;
// Citation markup the model sometimes echoes back verbatim, as [[web_source url="..."]] or <web_source>.
// Quoted attribute values may contain "]" or ">", so they are matched as units.
const ATTRS = `(?:\\s+(?:"[^"]*"|'[^']*'|[^\\]>"'])*)?`;
const STRAY_SOURCE = new RegExp(`\\[\\[/?web_source${ATTRS}\\]\\]|</?web_source${ATTRS}/?>`, "gi");
// The same token still arriving while streaming.
const STRAY_SOURCE_PARTIAL = new RegExp(
  `(?:\\[{1,2}|<)/?(?:web_source[^\\n]*|${"web_source".split("").map((_, n, a) => a.slice(0, n + 1).join("")).join("|")})$`,
  "i",
);
// NUL cannot appear in sane chat text, so it makes a collision-free placeholder.
const NUL = String.fromCharCode(0);
const MASK = new RegExp(`${NUL}(\\d+)${NUL}`, "g");

const TAG_NAMES = ["key", "note", "warn"];
// A marker still arriving, such as "[", "[[ke" or "[[/key]".
const PARTIAL_MARKER = /\[{1,2}\/?[a-z]*\]?$/;

// While a reply streams, hide half-typed markers and close open tags so the
// highlight shows up as it grows instead of flashing literal brackets.
function completeOpenTags(masked: string): string {
  let out = masked.replace(PARTIAL_MARKER, "");
  for (const tag of TAG_NAMES) {
    if (out.lastIndexOf(`[[${tag}]]`) > out.lastIndexOf(`[[/${tag}]]`)) out += `[[/${tag}]]`;
  }
  return out;
}

// Some models fence the styled block they were asked to render. A closed ```html fence whose
// content is a style-carrying <div> is the block itself, not code to show.
const STYLED_FENCE = /(^|\n)(```|~~~)html[ \t]*\n(\s*<div\b[^\n]*\bstyle=[\s\S]*?)\n\2[ \t]*(?=\n|$)/g;
const STYLED_START = /^<div\b[^>]*\bstyle=/;

const unwrapStyledFences = (text: string) =>
  text.replace(STYLED_FENCE, (_, lead: string, _fence: string, body: string) => lead + body);

// An html fence still open while streaming whose body already starts a styled <div>: the closing
// fence will turn it into the rendered block, so it is held back instead of flashing as code.
const OPEN_STYLED_FENCE = /^(\n?)(```|~~~)html[ \t]*\n\s*<div\b[^>]*\bstyle=/;
// A tag cut off mid-arrival, such as "<div sty". Attributes only count after a known name, so prose like "a < b" survives.
const PARTIAL_TAG = /<\/?(?:(?:div|span|p|b|i|em|strong|small|mark|aside)\s[^<>]*|[a-z]*)$/i;

const count = (line: string, needle: string) => line.split(needle).length - 1;

// A blank line followed by an indented line turns the rest of an HTML block into Markdown code,
// so inside a styled <div> block (up to where its divs close) blank lines and indentation go.
// Runs after code is masked, so fenced code is never mistaken for part of a block.
function tidyStyledBlocks(text: string): string {
  const out: string[] = [];
  let depth = 0;
  for (const line of text.split("\n")) {
    if (depth === 0 && !STYLED_START.test(line)) {
      out.push(line);
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;
    out.push(trimmed);
    depth = Math.max(0, depth + count(line, "<div") - count(line, "</div>"));
  }
  return out.join("\n");
}

export type Segment =
  | { kind: "md"; text: string }
  // A model-styled block. Still untrusted: the renderer filters tags, attributes and CSS.
  | { kind: "html"; html: string }
  | { kind: "callout"; tone: "note" | "warn"; text: string };

export interface Prepared {
  segments: Segment[];
  // True when a styled block is still being written and was cut out of the text.
  drawing: boolean;
}

const CALLOUT = /\[\[(note|warn)\]\]([\s\S]*?)\[\[\/\1\]\]/g;

// tidyStyledBlocks already trimmed the block's lines, so a block starts at a line that opens a styled <div> and runs
// to the line where its divs close (or to the end, while it is still streaming).
function splitStyledBlocks(text: string): Segment[] {
  const out: Segment[] = [];
  let md: string[] = [];
  let block: string[] = [];
  let depth = 0;
  const flushMd = () => {
    const joined = md.join("\n");
    if (joined.trim()) out.push({ kind: "md", text: joined });
    md = [];
  };
  for (const line of text.split("\n")) {
    if (depth === 0 && STYLED_START.test(line.trim())) {
      flushMd();
      block = [];
    }
    if (depth === 0 && block.length === 0 && !STYLED_START.test(line.trim())) {
      md.push(line);
      continue;
    }
    block.push(line.trim());
    depth = Math.max(0, depth + count(line, "<div") - count(line, "</div>"));
    if (depth === 0) {
      out.push({ kind: "html", html: block.join("\n") });
      block = [];
    }
  }
  if (block.length) out.push({ kind: "html", html: block.join("\n") });
  flushMd();
  return out;
}

function splitSegments(source: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of source.matchAll(CALLOUT)) {
    out.push(...splitStyledBlocks(source.slice(last, m.index)));
    out.push({ kind: "callout", tone: m[1] as "note" | "warn", text: m[2] ?? "" });
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(...splitStyledBlocks(source.slice(last)));
  return out;
}

// The held-back block is always the tail of the text (an open fence runs to the end), so it is
// reported as a flag rather than a marker in the text: reply text can then never forge it.
export function prepare(text: string, streaming = false): Prepared {
  const stash: string[] = [];
  let drawing = false;
  // Streamed chunks re-run this over the whole reply; most replies have no styled block at all.
  const styled = text.includes("style=");
  const masked = (styled ? unwrapStyledFences(text) : text).replace(CODE, (m) => {
    const open = streaming && OPEN_STYLED_FENCE.exec(m);
    if (open && !new RegExp(`\\n${open[2] ?? ""}[^\\n]*$`).test(m)) {
      drawing = true;
      return open[1] ?? "";
    }
    return `${NUL}${stash.push(m) - 1}${NUL}`;
  });
  const tidied = styled ? tidyStyledBlocks(masked) : masked;
  const stripped = tidied.replace(STRAY_SOURCE, "");
  const source = streaming
    ? completeOpenTags(stripped.replace(STRAY_SOURCE_PARTIAL, "").replace(PARTIAL_TAG, ""))
    : stripped;
  const unmask = (t: string) => t.replace(MASK, (_, i: string) => stash[Number(i)] ?? "");
  const segments = splitSegments(source).map((s): Segment => {
    if (s.kind === "html") return { kind: "html", html: unmask(s.html) };
    return { ...s, text: unmask(s.text) };
  });
  return { segments, drawing };
}
