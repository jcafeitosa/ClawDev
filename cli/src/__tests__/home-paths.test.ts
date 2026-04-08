import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolveClawDevHomeDir,
  resolveClawDevInstanceId,
} from "../config/home.js";

const ORIGINAL_ENV = { ...process.env };

describe("home path resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to ~/.clawdev and default instance", () => {
    delete process.env.CLAWDEV_HOME;
    delete process.env.CLAWDEV_INSTANCE_ID;

    const paths = describeLocalInstancePaths();
    expect(paths.homeDir).toBe(path.resolve(os.homedir(), ".clawdev"));
    expect(paths.instanceId).toBe("default");
    expect(paths.configPath).toBe(path.resolve(os.homedir(), ".clawdev", "instances", "default", "config.json"));
  });

  it("supports CLAWDEV_HOME and explicit instance ids", () => {
    process.env.CLAWDEV_HOME = "~/clawdev-home";

    const home = resolveClawDevHomeDir();
    expect(home).toBe(path.resolve(os.homedir(), "clawdev-home"));
    expect(resolveClawDevInstanceId("dev_1")).toBe("dev_1");
  });

  it("rejects invalid instance ids", () => {
    expect(() => resolveClawDevInstanceId("bad/id")).toThrow(/Invalid instance id/);
  });

  it("expands ~ prefixes", () => {
    expect(expandHomePrefix("~")).toBe(os.homedir());
    expect(expandHomePrefix("~/x/y")).toBe(path.resolve(os.homedir(), "x/y"));
  });
});
