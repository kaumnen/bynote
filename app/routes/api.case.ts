import {
  getCase,
  submitCaseAction,
} from "../lib/cases.server";
import { CaseActionSchema } from "../../src/shared/schemas";
import type { Route } from "./+types/api.case";

export async function loader({ params }: Route.LoaderArgs) {
  const state = await getCase(params.caseId);
  if (!state) {
    return Response.json({ error: "Case not found" }, { status: 404 });
  }

  return Response.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CaseActionSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid action",
        issues: parsed.error.issues.map(({ path, message }) => ({
          path: path.join("."),
          message,
        })),
      },
      { status: 400 },
    );
  }

  const state = await submitCaseAction(params.caseId, parsed.data);
  return Response.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
