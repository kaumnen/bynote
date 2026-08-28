import { describe, expect, it } from "vitest";

import {
  DEMO_DEFAULTS,
  isDefaultDemoTitle,
  isDemoKind,
  resolveDemoTitle,
} from "./demos";

describe("demo catalog", () => {
  it("uses the default title when the name is blank", () => {
    expect(resolveDemoTitle("bug", "  ")).toBe(DEMO_DEFAULTS.bug.title);
    expect(isDefaultDemoTitle("incident", DEMO_DEFAULTS.incident.title)).toBe(
      true,
    );
    expect(isDefaultDemoTitle("feature", "Saturday export drill")).toBe(false);
    expect(isDemoKind("custom")).toBe(false);
  });
});
