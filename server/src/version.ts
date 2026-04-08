type PackageJson = {
  version?: string;
};

const pkg = JSON.parse(await Bun.file(new URL("../package.json", import.meta.url)).text()) as PackageJson;

export const serverVersion = pkg.version ?? "0.0.0";
