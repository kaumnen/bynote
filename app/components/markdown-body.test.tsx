import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkdownBody } from "./markdown-body";

function html(source: string) {
  return renderToStaticMarkup(<MarkdownBody source={source} />);
}

describe("MarkdownBody", () => {
  it("renders ATX and setext headings as a visible scale", () => {
    const atx = html("# Audience\n\n## Messaging\n\n### Channel");
    expect(atx).toContain('<h3 class="md-heading md-h1">Audience</h3>');
    expect(atx).toContain('<h4 class="md-heading md-h2">Messaging</h4>');
    expect(atx).toContain('<h5 class="md-heading md-h3">Channel</h5>');
    expect(atx).not.toContain("<h1");
    expect(atx).not.toContain("<h2");

    const setext = html("Audience\n========\n\nMessaging\n---------");
    expect(setext).toContain('<h3 class="md-heading md-h1">Audience</h3>');
    expect(setext).toContain('<h4 class="md-heading md-h2">Messaging</h4>');
  });

  it("renders emphasis, lists, tables, and fenced code", () => {
    const source = [
      "**Lead** with _reliability_.",
      "",
      "- Partner webinar",
      "- Sales one-pager",
      "",
      "| Channel | Owner |",
      "| --- | --- |",
      "| Webinar | Alex |",
      "",
      "```js",
      "const ok = true;",
      "```",
      "",
      "~~old copy~~",
      "",
      "[site](https://example.com)",
    ].join("\n");
    const rendered = html(source);

    expect(rendered).toContain("<strong>Lead</strong>");
    expect(rendered).toContain("<em>reliability</em>");
    expect(rendered).toContain('<p class="md-p">');
    expect(rendered).toContain('<ul class="md-list">');
    expect(rendered).toContain("<li>Partner webinar</li>");
    expect(rendered).toContain("<th>Channel</th>");
    expect(rendered).toContain("<td>Alex</td>");
    expect(rendered).toContain("<pre><code");
    expect(rendered).toContain("const ok = true;");
    expect(rendered).toContain("<del>old copy</del>");
    expect(rendered).toContain('href="https://example.com"');
  });

  it("keeps mermaid fences out of ordinary code blocks", () => {
    const rendered = html("```mermaid\nflowchart LR\n  A --> B\n```");
    expect(rendered).toContain("mermaid-pending");
    expect(rendered).toContain("flowchart LR");
    expect(rendered).not.toContain("language-mermaid");
  });

  it("drops javascript urls", () => {
    const rendered = html("[x](javascript:alert(1))");
    expect(rendered).not.toContain("javascript:");
    expect(rendered).toContain("<span>x</span>");
  });

  it("does not render raw HTML as elements", () => {
    const rendered = html("Hello <script>alert(1)</script>");
    expect(rendered).not.toContain("<script");
    expect(rendered).toContain("Hello");
  });

  it("renders GFM task lists as disabled checkboxes", () => {
    const rendered = html("- [x] Done\n- [ ] Open");
    expect(rendered).toContain("contains-task-list");
    expect(rendered).toContain('type="checkbox"');
    expect(rendered).toContain("disabled");
    expect(rendered).toContain("Done");
    expect(rendered).toContain("Open");
  });

  it("enables GFM task lists when they can be toggled", () => {
    const rendered = renderToStaticMarkup(
      <MarkdownBody source="- [ ] Open" onToggleTask={() => {}} />,
    );
    expect(rendered).toContain('type="checkbox"');
    expect(rendered).not.toContain("disabled");
  });
});
