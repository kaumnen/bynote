import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import {
  fencedCodeText,
  isMermaidLanguage,
  markdownHeadingClass,
  markdownHeadingTag,
} from "../../src/shared/markdown";

function MarkdownLink({
  href,
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  if (!href || /^(javascript|vbscript|data):/i.test(href)) {
    return <span>{children}</span>;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  if (!src || /^(javascript|vbscript|data):/i.test(src)) {
    return alt ? <em>{alt}</em> : null;
  }

  return <img src={src} alt={alt ?? ""} />;
}

function MarkdownHeading({
  level,
  children,
}: {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children?: ReactNode;
}) {
  const Tag = markdownHeadingTag(level);
  return <Tag className={markdownHeadingClass(level)}>{children}</Tag>;
}

function MermaidBlock({ chart }: { chart: string }) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "") || "diagram";
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void import("../lib/render-mermaid.client")
        .then(({ renderMermaid }) => renderMermaid(`mermaid-${reactId}`, chart))
        .then((next) => {
          if (!cancelled) {
            setSvg(next);
            setFailed(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setFailed(true);
            setSvg(null);
          }
        });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [chart, reactId]);

  if (failed || !svg) {
    return (
      <pre className={failed ? "mermaid-fallback" : "mermaid-pending"}>
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <div
      className="mermaid-block"
      role="img"
      aria-label="Diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function firstElement(children: ReactNode) {
  return Children.toArray(children).find((node) => isValidElement(node));
}

function MarkdownPre({ children }: { children?: ReactNode }) {
  const child = firstElement(children);
  if (
    isValidElement<{ className?: string; children?: ReactNode }>(child) &&
    isMermaidLanguage(child.props.className)
  ) {
    return <MermaidBlock chart={fencedCodeText(child.props.children)} />;
  }

  return <pre>{children}</pre>;
}

function MarkdownCheckbox({
  checked,
  type,
  disabled,
  onToggle,
}: {
  checked?: boolean;
  type?: string;
  disabled?: boolean;
  onToggle?: (index: number) => void;
}) {
  if (type !== "checkbox") {
    return null;
  }

  return (
    <input
      type="checkbox"
      checked={Boolean(checked)}
      disabled={disabled}
      onChange={(event) => {
        if (!onToggle) {
          return;
        }

        const root = event.currentTarget.closest(".markdown-body");
        if (!root) {
          return;
        }

        const boxes = root.querySelectorAll('input[type="checkbox"]');
        const index = Array.from(boxes).indexOf(event.currentTarget);
        if (index >= 0) {
          onToggle(index);
        }
      }}
    />
  );
}

function classNames(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function MarkdownParagraph({ children }: { children?: ReactNode }) {
  return <p className="md-p">{children}</p>;
}

function MarkdownUnorderedList({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return <ul className={classNames("md-list", className)}>{children}</ul>;
}

function MarkdownOrderedList({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return <ol className={classNames("md-list", className)}>{children}</ol>;
}

const markdownComponents = {
  a: MarkdownLink,
  img: MarkdownImage,
  p: MarkdownParagraph,
  ul: MarkdownUnorderedList,
  ol: MarkdownOrderedList,
  pre: MarkdownPre,
  input: MarkdownCheckbox,
  h1: ({ children }: { children?: ReactNode }) => (
    <MarkdownHeading level={1}>{children}</MarkdownHeading>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <MarkdownHeading level={2}>{children}</MarkdownHeading>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <MarkdownHeading level={3}>{children}</MarkdownHeading>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <MarkdownHeading level={4}>{children}</MarkdownHeading>
  ),
  h5: ({ children }: { children?: ReactNode }) => (
    <MarkdownHeading level={5}>{children}</MarkdownHeading>
  ),
  h6: ({ children }: { children?: ReactNode }) => (
    <MarkdownHeading level={6}>{children}</MarkdownHeading>
  ),
};

export function MarkdownBody({
  source,
  onToggleTask,
}: {
  source: string;
  onToggleTask?: (index: number) => void;
}) {
  const onToggleTaskRef = useRef(onToggleTask);
  onToggleTaskRef.current = onToggleTask;
  const canToggle = Boolean(onToggleTask);

  const components = useMemo(
    () => ({
      ...markdownComponents,
      input: ({
        checked,
        type,
      }: {
        checked?: boolean;
        type?: string;
      }) => (
        <MarkdownCheckbox
          checked={checked}
          type={type}
          disabled={!canToggle}
          onToggle={
            canToggle
              ? (index) => onToggleTaskRef.current?.(index)
              : undefined
          }
        />
      ),
    }),
    [canToggle],
  );

  if (!source.trim()) {
    return null;
  }

  return (
    <div className="markdown-body">
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
      >
        {source}
      </Markdown>
    </div>
  );
}
