let mermaid: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!mermaid) {
    mermaid = import("mermaid").then((mod) => {
      const api = mod.default;
      api.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "neutral",
        fontFamily: '"Departure Mono", "SFMono-Regular", Consolas, monospace',
        flowchart: { htmlLabels: false, useMaxWidth: true },
        sequence: { useMaxWidth: true },
        gantt: { useMaxWidth: true, fontSize: 12 },
        journey: { useMaxWidth: true },
      });
      return api;
    });
  }

  return mermaid;
}

export async function renderMermaid(id: string, chart: string) {
  const api = await loadMermaid();
  const { svg } = await api.render(id, chart);
  return svg;
}
