import {
  CaseStateSchema,
  type CaseAction,
  type CaseState,
} from "../../src/shared/schemas";

async function parseResponse(response: Response): Promise<CaseState> {
  const body = await response.json();
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "Request failed";
    throw new Error(message);
  }

  return CaseStateSchema.parse(body);
}

export async function fetchCase(caseId: string) {
  return parseResponse(
    await fetch(`/api/cases/${caseId}`, {
      headers: { Accept: "application/json" },
    }),
  );
}

export async function sendCaseAction(
  caseId: string,
  action: CaseAction,
) {
  return parseResponse(
    await fetch(`/api/cases/${caseId}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(action),
    }),
  );
}

export function caseSocketUrl(caseId: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/cases/${caseId}/live`;
}
