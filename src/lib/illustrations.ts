// Splits a reply into text, stored illustrations and "being illustrated" placeholders.
// The model writes `[[image: ...]]`; the server swaps each for `[[img:<id>]]` once the picture exists.
export interface Illustration {
  id: string;
  prompt: string | null;
}

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "image"; illustration: Illustration }
  | { kind: "pending" };

const MARKER = /\[\[(?:image:([\s\S]*?)|img:([0-9a-f]{32}))\]\]/g;
const OPENERS = ["[[image:", "[[img:"];

// While streaming, a directive may be cut mid-way ("[[ima"); drop that tail so it never flashes as text.
function withoutPartialTail(text: string): string {
  const start = text.lastIndexOf("[[");
  if (start >= 0) {
    const tail = text.slice(start);
    if (!tail.includes("]]") && OPENERS.some((o) => o.startsWith(tail) || tail.startsWith(o))) return text.slice(0, start);
  }
  return text.endsWith("[") && !text.endsWith("[[") ? text.slice(0, -1) : text;
}

// Pass one pairs directives with arrived pictures by prompt (the server trims it and caps its length); pass two gives
// whatever is left to the remaining directives in order. Returns directive index -> picture.
function assignArrived(source: string, arrived: readonly Illustration[]): Map<number, Illustration> {
  const wants = [...source.matchAll(MARKER)].filter((m) => m[2] === undefined).map((m) => (m[1] ?? "").trim());
  const out = new Map<number, Illustration>();
  const used = new Set<number>();
  const claimWith = (matches: (want: string, prompt: string) => boolean) =>
    wants.forEach((want, d) => {
      if (out.has(d) || want === "") return;
      const at = arrived.findIndex((a, i) => !used.has(i) && a.prompt !== null && a.prompt.trim() !== "" && matches(want, a.prompt.trim()));
      if (at >= 0) {
        used.add(at);
        out.set(d, arrived[at] as Illustration);
      }
    });
  // Exact first, so "a cat" cannot take the picture of "a cat on a mat" just because it comes first.
  claimWith((want, prompt) => want === prompt);
  claimWith((want, prompt) => want.startsWith(prompt));
  wants.forEach((_, d) => {
    if (out.has(d)) return;
    const at = arrived.findIndex((_a, i) => !used.has(i));
    if (at >= 0) {
      used.add(at);
      out.set(d, arrived[at] as Illustration);
    }
  });
  return out;
}

// Only ids in `known` (that message's own images) become pictures, so reply text can't point at other files.
// `arrived` are pictures whose `image` event came in before the reply was saved. Pictures are generated in parallel, so
// they can finish out of order: a directive takes the arrived picture with its own prompt, else the next unused one.
// `illustrate` false (the turn was sent with pictures off): a directive left in the text never gets a skeleton, since the
// server strips it; only pictures that really arrived are shown.
export function splitReply(
  content: string,
  known: Illustration[],
  streaming: boolean,
  arrived: readonly Illustration[] = [],
  illustrate = true,
): Segment[] {
  const byId = new Map(known.map((i) => [i.id, i]));
  const source = streaming ? withoutPartialTail(content) : content;
  const out: Segment[] = [];
  const pushText = (text: string) => {
    if (text.trim() !== "") out.push({ kind: "text", text });
  };

  const assigned = streaming ? assignArrived(source, arrived) : new Map<number, Illustration>();
  let directive = 0;

  let last = 0;
  for (const m of source.matchAll(MARKER)) {
    pushText(source.slice(last, m.index));
    last = m.index + m[0].length;
    const id = m[2];
    if (id === undefined) {
      // A directive still in the text: the picture is on its way while streaming, stale otherwise.
      if (streaming) {
        const live = assigned.get(directive++);
        if (live) out.push({ kind: "image", illustration: live });
        else if (illustrate) out.push({ kind: "pending" });
      }
      continue;
    }
    const illustration = byId.get(id);
    if (illustration) out.push({ kind: "image", illustration });
  }
  pushText(source.slice(last));
  return out;
}

// What "Copy" puts on the clipboard: the story text without markers or placeholders.
export function copyText(content: string): string {
  return content.replace(MARKER, "").replace(/\n{3,}/g, "\n\n").trim();
}
