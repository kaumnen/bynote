import { createCase } from "../lib/cases.server";
import { CreateCaseInputSchema } from "../../src/shared/schemas";
import type { Route } from "./+types/api.cases";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateCaseInputSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({ error: "Invalid case details" }, { status: 400 });
  }

  const state = await createCase(parsed.data);
  return Response.json(state, {
    status: 201,
    headers: { Location: `/cases/${state.id}` },
  });
}
