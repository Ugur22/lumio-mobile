import { safeStyle } from "./style";

// The model's styled blocks are untrusted. On the phone nothing executes, but a tag could still load a picture
// (a tracking pixel) or open a link, so only plain text containers survive and each keeps nothing but its filtered
// `style`. This runs on the string before the HTML renderer sees it.
const ALLOWED = new Set([
  "div", "span", "p", "b", "i", "u", "s", "em", "strong", "small", "mark", "br", "hr", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre",
]);
// Their content is not text for the reader either, so it goes with the tag.
const WITH_CONTENT = /<(script|style|iframe|object|embed|svg|math|template|noscript)\b[\s\S]*?(?:<\/\1\s*>|$)/gi;
const COMMENT = /<!--[\s\S]*?(?:-->|$)/g;
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>?/g;
const STYLE_ATTR = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

export function sanitizeBlockHtml(html: string): string {
  return html
    .replace(WITH_CONTENT, "")
    .replace(COMMENT, "")
    .replace(TAG, (_all, slash: string, rawName: string, attrs: string) => {
      const name = rawName.toLowerCase();
      if (!ALLOWED.has(name)) return "";
      if (slash) return `</${name}>`;
      const given = STYLE_ATTR.exec(attrs);
      // A double quote in a single-quoted value would end our attribute early.
      const style = given ? safeStyle(given[1] ?? given[2] ?? "").replace(/"/g, "'") : "";
      return style ? `<${name} style="${style}">` : `<${name}>`;
    });
}
