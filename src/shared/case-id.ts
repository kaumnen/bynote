export const NOTEBOOK_ID = /^[a-f0-9]{32}$/;

export function isNotebookId(value: string) {
  return NOTEBOOK_ID.test(value);
}

export function newNotebookId() {
  return crypto.randomUUID().replaceAll("-", "");
}
