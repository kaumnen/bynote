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

const FENCE_LINE = /^\s{0,3}```/;
const TASK_LINE =
  /^((?:\s*>)*\s*(?:[-*+]|\d{1,9}\.)\s+)\[([ xX])\](?=\s|$)/;

export function markdownTaskCount(source: string) {
  let inFence = false;
  let count = 0;

  for (const line of source.split("\n")) {
    if (FENCE_LINE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && TASK_LINE.test(line)) {
      count += 1;
    }
  }

  return count;
}

export function toggleMarkdownTask(source: string, taskIndex: number) {
  if (!Number.isInteger(taskIndex) || taskIndex < 0) {
    return null;
  }

  let inFence = false;
  let current = -1;
  const lines = source.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    if (FENCE_LINE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }

    const match = TASK_LINE.exec(line);
    if (!match) {
      continue;
    }

    current += 1;
    if (current !== taskIndex) {
      continue;
    }

    const prefix = match[1] ?? "";
    const mark = match[2] === " " ? "x" : " ";
    lines[lineIndex] = `${prefix}[${mark}]${line.slice(match[0].length)}`;
    return lines.join("\n");
  }

  return null;
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
