import { describe, expect, it } from "vitest";

import { CaseKindSchema } from "./schemas";
import {
  DEMO_DEFAULTS,
  DEMO_GROUPS,
  DEMO_KINDS,
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
    expect(isDemoKind("plan")).toBe(true);
    expect(isDemoKind("campaign")).toBe(true);
  });

  it("puts work samples before engineering samples", () => {
    expect(DEMO_GROUPS.map(({ label }) => label)).toEqual([
      "Work",
      "Engineering",
    ]);
    expect(DEMO_GROUPS[0]?.kinds).toEqual(["plan", "campaign", "meeting"]);
  });

  it("offers a filled sample for every notebook kind except blank", () => {
    expect([...DEMO_KINDS].sort()).toEqual(
      [...CaseKindSchema.options.filter((kind) => kind !== "custom")].sort(),
    );
  });
});
