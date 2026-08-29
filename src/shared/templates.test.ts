import { describe, expect, it } from "vitest";

import { CaseKindSchema } from "./schemas";
import {
  TEMPLATE_GROUPS,
  createFieldCopy,
  defaultSeverityFor,
  describeSection,
  kindLabel,
  kindUsesSeverity,
  sectionCopy,
  sectionsForTemplate,
  SECTION_PALETTE,
  statusOptions,
} from "./templates";

describe("template kind copy", () => {
  it("keeps severity for incidents and bugs only", () => {
    expect(kindUsesSeverity("incident")).toBe(true);
    expect(kindUsesSeverity("bug")).toBe(true);
    expect(kindUsesSeverity("plan")).toBe(false);
    expect(kindUsesSeverity("campaign")).toBe(false);
    expect(kindUsesSeverity("meeting")).toBe(false);
    expect(kindUsesSeverity("feature")).toBe(false);
    expect(kindUsesSeverity("custom")).toBe(false);
    expect(defaultSeverityFor("feature")).toBe("medium");
    expect(defaultSeverityFor("incident")).toBe("high");
  });

  it("uses work status language outside engineering incidents", () => {
    expect(kindLabel("custom")).toBe("Blank");
    expect(kindLabel("campaign")).toBe("Campaign");
    expect(statusOptions("incident").map(({ label }) => label)).toContain(
      "Investigating",
    );
    expect(statusOptions("campaign").map(({ label }) => label)).toEqual([
      "Open",
      "In progress",
      "Paused",
      "Done",
    ]);
    expect(createFieldCopy("custom").title).toBe("Untitled notebook");
  });

  it("groups every notebook kind once", () => {
    const grouped = TEMPLATE_GROUPS.flatMap(({ kinds }) => kinds);
    expect([...grouped].sort()).toEqual([...CaseKindSchema.options].sort());
    expect(TEMPLATE_GROUPS[0]?.id).toBe("work");
    expect(TEMPLATE_GROUPS[1]?.id).toBe("engineering");
  });

  it("seeds campaign and meeting sections for GTM work", () => {
    let next = 0;
    const campaign = sectionsForTemplate("campaign", () => `id-${++next}`);
    const meeting = sectionsForTemplate("meeting", () => `id-${++next}`);
    expect(campaign.map(({ title }) => title)).toEqual([
      "Audience",
      "Messaging",
      "Channels",
      "Tasks",
      "Decisions",
    ]);
    expect(meeting.map(({ title }) => title)).toEqual([
      "Agenda",
      "Notes",
      "Decisions",
      "Tasks",
    ]);
  });

  it("names every section type for people and agents", () => {
    expect(sectionCopy("note")).toEqual({
      type: "note",
      label: "Note",
      hint: "A freeform written block",
    });
    expect(
      describeSection({ id: "s1", type: "tasks", title: "Next" }),
    ).toEqual({
      id: "s1",
      type: "tasks",
      typeLabel: "Tasks",
      hint: "Work to do",
      title: "Next",
    });
    expect(SECTION_PALETTE.map(({ type }) => type)).toEqual([
      "note",
      "timeline",
      "findings",
      "hypotheses",
      "tasks",
      "checklist",
      "decisions",
    ]);
  });
});
