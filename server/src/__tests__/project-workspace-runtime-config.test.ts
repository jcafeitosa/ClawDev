import { describe, expect, it } from "vitest";
import {
  mergeProjectWorkspaceRuntimeConfig,
  readProjectWorkspaceRuntimeConfig,
} from "../services/project-workspace-runtime-config.js";

describe("project workspace runtime config", () => {
  it("reads the canonical runtimeConfig field", () => {
    expect(
      readProjectWorkspaceRuntimeConfig({
        runtimeConfig: {
          workspaceRuntime: { services: [{ name: "api" }] },
          desiredState: "running",
        },
      }),
    ).toEqual({
      workspaceRuntime: { services: [{ name: "api" }] },
      desiredState: "running",
    });
  });

  it("falls back to legacy config payloads", () => {
    expect(
      readProjectWorkspaceRuntimeConfig({
        config: {
          workspaceRuntime: { services: [{ name: "worker" }] },
          desiredState: "stopped",
        },
      }),
    ).toEqual({
      workspaceRuntime: { services: [{ name: "worker" }] },
      desiredState: "stopped",
    });
  });

  it("merges runtimeConfig into metadata and removes legacy config", () => {
    expect(
      mergeProjectWorkspaceRuntimeConfig(
        {
          title: "workspace",
          config: {
            workspaceRuntime: { services: [{ name: "legacy" }] },
            desiredState: "running",
          },
        },
        {
          workspaceRuntime: { services: [{ name: "api" }] },
          desiredState: "stopped",
        },
      ),
    ).toEqual({
      title: "workspace",
      runtimeConfig: {
        workspaceRuntime: { services: [{ name: "api" }] },
        desiredState: "stopped",
      },
    });
  });
});
