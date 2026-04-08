import { describe, expect, it } from "vitest";
import {
  composeStructuredSddDescription,
  parseStructuredSddDescription,
  validateStructuredSddInput,
} from "./sdd.js";

describe("structured delivery description", () => {
  it("round-trips composed descriptions into structured sections", () => {
    const description = composeStructuredSddDescription({
      subjectLabel: "Project: Launch Platform",
      summary: "Launch the platform in a controlled delivery sequence with clear ownership.",
      spec: "Define the launch scope, the acceptance criteria, and the operator ownership for the change.",
      design: "Split the delivery into a single-owner path with explicit validation gates and a safe review flow.",
      risk: "The main risk is a partial rollout that leaves the description or the execution state inconsistent.",
      rollout: "Roll out the change in one controlled milestone and only widen scope after the first checkpoint passes.",
      rollback: "If any checkpoint fails, revert the update and restore the prior structured description immediately.",
      validation: "Confirm the sections are present, meaningful, and safe to execute before the change is accepted.",
    });

    expect(parseStructuredSddDescription(description)).toEqual({
      subjectLabel: "Project: Launch Platform",
      summary: "Launch the platform in a controlled delivery sequence with clear ownership.",
      spec: "Define the launch scope, the acceptance criteria, and the operator ownership for the change.",
      design: "Split the delivery into a single-owner path with explicit validation gates and a safe review flow.",
      risk: "The main risk is a partial rollout that leaves the description or the execution state inconsistent.",
      rollout: "Roll out the change in one controlled milestone and only widen scope after the first checkpoint passes.",
      rollback: "If any checkpoint fails, revert the update and restore the prior structured description immediately.",
      validation: "Confirm the sections are present, meaningful, and safe to execute before the change is accepted.",
    });
  });

  it("treats plain text as a summary fallback", () => {
    expect(parseStructuredSddDescription("plain summary only")).toEqual({
      subjectLabel: "",
      summary: "plain summary only",
      spec: "",
      design: "",
      risk: "",
      rollout: "",
      rollback: "",
      validation: "",
    });
  });

  it("requires meaningful content in every structured section", () => {
    expect(
      validateStructuredSddInput({
        spec: "too short",
        design: "Also short",
        risk: "Short risk",
        rollout: "Short rollout",
        rollback: "Short rollback",
        validation: "Short validation",
      }),
    ).toHaveLength(6);
  });
});
