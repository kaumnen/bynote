import { describe, expect, it } from "vitest";

import {
  fencedCodeText,
  isMermaidLanguage,
  markdownHeadingClass,
  markdownHeadingTag,
  mermaidBlocks,
} from "./markdown";

describe("markdown helpers", () => {
  it("detects mermaid fenced code", () => {
    expect(isMermaidLanguage("language-mermaid")).toBe(true);
    expect(isMermaidLanguage("language-MERMAID")).toBe(true);
    expect(isMermaidLanguage("language-js")).toBe(false);
    expect(isMermaidLanguage(undefined)).toBe(false);
  });

  it("trims the trailing newline from fenced code", () => {
    expect(fencedCodeText("flowchart LR\n  A --> B\n")).toBe(
      "flowchart LR\n  A --> B",
    );
  });

  it("keeps markdown headings below the page and section titles", () => {
    expect(markdownHeadingTag(1)).toBe("h3");
    expect(markdownHeadingTag(2)).toBe("h4");
    expect(markdownHeadingTag(3)).toBe("h5");
    expect(markdownHeadingTag(6)).toBe("h6");
    expect(markdownHeadingClass(1)).toBe("md-heading md-h1");
    expect(markdownHeadingClass(2)).toBe("md-heading md-h2");
  });

  it("extracts mermaid fences from a note", () => {
    expect(
      mermaidBlocks("before\n```mermaid\nflowchart LR\n  A --> B\n```\nafter"),
    ).toEqual(["flowchart LR\n  A --> B"]);
  });
});
