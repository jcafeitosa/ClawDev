import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyDataDirOverride } from "../config/data-dir.js";

const ORIGINAL_ENV = { ...process.env };

describe("applyDataDirOverride", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CLAWDEV_HOME;
    delete process.env.CLAWDEV_CONFIG;
    delete process.env.CLAWDEV_CONTEXT;
    delete process.env.CLAWDEV_INSTANCE_ID;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("sets CLAWDEV_HOME and isolated default config/context paths", () => {
    const home = applyDataDirOverride({
      dataDir: "~/clawdev-data",
      config: undefined,
      context: undefined,
    }, { hasConfigOption: true, hasContextOption: true });

    const expectedHome = path.resolve(os.homedir(), "clawdev-data");
    expect(home).toBe(expectedHome);
    expect(process.env.CLAWDEV_HOME).toBe(expectedHome);
    expect(process.env.CLAWDEV_CONFIG).toBe(
      path.resolve(expectedHome, "instances", "default", "config.json"),
    );
    expect(process.env.CLAWDEV_CONTEXT).toBe(path.resolve(expectedHome, "context.json"));
    expect(process.env.CLAWDEV_INSTANCE_ID).toBe("default");
  });

  it("uses the provided instance id when deriving default config path", () => {
    const home = applyDataDirOverride({
      dataDir: "/tmp/clawdev-alt",
      instance: "dev_1",
      config: undefined,
      context: undefined,
    }, { hasConfigOption: true, hasContextOption: true });

    expect(home).toBe(path.resolve("/tmp/clawdev-alt"));
    expect(process.env.CLAWDEV_INSTANCE_ID).toBe("dev_1");
    expect(process.env.CLAWDEV_CONFIG).toBe(
      path.resolve("/tmp/clawdev-alt", "instances", "dev_1", "config.json"),
    );
  });

  it("does not override explicit config/context settings", () => {
    process.env.CLAWDEV_CONFIG = "/env/config.json";
    process.env.CLAWDEV_CONTEXT = "/env/context.json";

    applyDataDirOverride({
      dataDir: "/tmp/clawdev-alt",
      config: "/flag/config.json",
      context: "/flag/context.json",
    }, { hasConfigOption: true, hasContextOption: true });

    expect(process.env.CLAWDEV_CONFIG).toBe("/env/config.json");
    expect(process.env.CLAWDEV_CONTEXT).toBe("/env/context.json");
  });

  it("only applies defaults for options supported by the command", () => {
    applyDataDirOverride(
      {
        dataDir: "/tmp/clawdev-alt",
      },
      { hasConfigOption: false, hasContextOption: false },
    );

    expect(process.env.CLAWDEV_HOME).toBe(path.resolve("/tmp/clawdev-alt"));
    expect(process.env.CLAWDEV_CONFIG).toBeUndefined();
    expect(process.env.CLAWDEV_CONTEXT).toBeUndefined();
  });
});
