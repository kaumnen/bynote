import { connectToCase } from "../lib/cases.server";
import type { Route } from "./+types/api.live";

export function loader({ request, params }: Route.LoaderArgs) {
  return connectToCase(params.caseId, request);
}
