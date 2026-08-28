import { env } from "cloudflare:workers";

import {
  CaseActionSchema,
  CaseStateSchema,
  CreateCaseInputSchema,
  type CaseAction,
  type CaseState,
  type CreateCaseInput,
} from "../../src/shared/schemas";

const CASE_ID_PATTERN = /^[a-f0-9]{32}$/;

function caseStub(caseId: string) {
  if (!CASE_ID_PATTERN.test(caseId)) {
    throw new Response("Case not found", { status: 404 });
  }

  const id = env.CASES.idFromName(caseId);
  return env.CASES.get(id);
}

async function readCaseResponse(response: Response): Promise<CaseState> {
  const body = await response.json();
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "Case request failed";
    throw new Response(message, { status: response.status });
  }

  return CaseStateSchema.parse(body);
}

export async function createCase(input: CreateCaseInput) {
  const parsed = CreateCaseInputSchema.parse(input);
  const caseId = crypto.randomUUID().replaceAll("-", "");
  const response = await caseStub(caseId).fetch(
    new Request(`https://case.internal/init?id=${caseId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    }),
  );

  return readCaseResponse(response);
}

export async function getCase(caseId: string) {
  const response = await caseStub(caseId).fetch(
    new Request("https://case.internal/state"),
  );
  if (response.status === 404) {
    return null;
  }

  return readCaseResponse(response);
}

export async function submitCaseAction(
  caseId: string,
  action: CaseAction,
) {
  const parsed = CaseActionSchema.parse(action);
  const response = await caseStub(caseId).fetch(
    new Request("https://case.internal/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    }),
  );

  return readCaseResponse(response);
}

export function connectToCase(caseId: string, request: Request) {
  return caseStub(caseId).fetch(
    new Request("https://case.internal/live", {
      headers: request.headers,
    }),
  );
}
