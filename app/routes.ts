import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("cases/:caseId", "routes/case.tsx"),
  route("api/cases", "routes/api.cases.ts"),
  route("api/cases/:caseId", "routes/api.case.ts"),
  route("api/cases/:caseId/live", "routes/api.live.ts"),
] satisfies RouteConfig;
