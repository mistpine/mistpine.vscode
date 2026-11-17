// Just enough of Node's types for forecast.ts, so the sample needs no install.
declare module "node:fs/promises" {
  export function readFile(path: string, encoding: "utf8"): Promise<string>;
}
