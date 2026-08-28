import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("notebook", "routes/case.tsx"),
] satisfies RouteConfig;
