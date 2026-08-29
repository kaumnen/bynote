export function isMermaidLanguage(className?: string | null) {
  const language = /(?:^|\s)language-([a-z0-9+-]+)/i.exec(className ?? "")?.[1];
  return language?.toLowerCase() === "mermaid";
}

export function fencedCodeText(children: unknown) {
  return String(children).replace(/\n$/, "");
}

export function mermaidBlocks(source: string) {
  return [...source.matchAll(/```mermaid[^\n]*\n([\s\S]*?)```/gi)].map(
    (match) => (match[1] ?? "").replace(/\n$/, "").trim(),
  );
}

export function markdownHeadingLevel(level: number) {
  if (level < 1) {
    return 1;
  }
  if (level > 6) {
    return 6;
  }
  return level;
}

export function markdownHeadingTag(
  level: number,
): "h3" | "h4" | "h5" | "h6" {
  const heading = markdownHeadingLevel(level);
  if (heading === 1) {
    return "h3";
  }
  if (heading === 2) {
    return "h4";
  }
  if (heading === 3) {
    return "h5";
  }
  return "h6";
}

export function markdownHeadingClass(level: number) {
  return `md-heading md-h${markdownHeadingLevel(level)}`;
}
