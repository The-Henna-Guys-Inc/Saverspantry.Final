// Tiny safe markdown renderer for our legal docs.
// Supports: # h1, ## h2, ### h3, **bold**, *italic*, `code`, - lists, paragraphs, blank lines.
import { useMemo } from "react";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inline = (s: string) =>
  escape(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='px-1 rounded bg-muted text-xs'>$1</code>");

export const Markdown = ({ content }: { content: string }) => {
  const html = useMemo(() => {
    const lines = content.split(/\r?\n/);
    const out: string[] = [];
    let inList = false;
    let para: string[] = [];
    const flushPara = () => {
      if (para.length) {
        out.push(`<p class="text-sm text-foreground/90 leading-relaxed mb-3">${inline(para.join(" "))}</p>`);
        para = [];
      }
    };
    const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) { flushPara(); closeList(); continue; }
      const h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        flushPara(); closeList();
        const lvl = h[1].length;
        const cls = lvl === 1 ? "text-2xl font-bold text-primary mb-3 mt-4"
                  : lvl === 2 ? "text-lg font-semibold text-primary mb-2 mt-4"
                  : "text-base font-semibold text-foreground mb-2 mt-3";
        out.push(`<h${lvl} class="${cls}">${inline(h[2])}</h${lvl}>`);
        continue;
      }
      const li = line.match(/^[-*]\s+(.*)$/);
      if (li) {
        flushPara();
        if (!inList) { out.push('<ul class="list-disc pl-5 space-y-1 mb-3 text-sm text-foreground/90">'); inList = true; }
        out.push(`<li>${inline(li[1])}</li>`);
        continue;
      }
      if (line.startsWith("_") && line.endsWith("_")) {
        flushPara(); closeList();
        out.push(`<p class="text-xs text-muted-foreground mb-4">${inline(line.slice(1, -1))}</p>`);
        continue;
      }
      para.push(line);
    }
    flushPara(); closeList();
    return out.join("\n");
  }, [content]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};
