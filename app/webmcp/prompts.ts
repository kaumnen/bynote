export function libraryAgentPrompt() {
  return [
    "You are on the Bynote home page.",
    "Call list_notebooks to see notebooks in this browser.",
    "Call open_notebook with an id to work on one. The tab will open that notebook and writing tools will apply to it.",
    "If none exist, call create_notebook, then continue there.",
  ].join("\n");
}

export function notebookAgentPrompt() {
  return [
    "You are in Bynote. The notebook open in this tab is the one to work on.",
    "Call read_case first. Call join_as_agent before you add work.",
    "If you need a different notebook, call list_notebooks, then open_notebook.",
    "If it has no sections, add a Goal note and a Tasks section.",
    "Add one useful note or finding, then add one task.",
  ].join("\n");
}
