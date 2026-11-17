/**
 * The apps pnpm verify and pnpm render run: VS Code and Cursor, downloaded
 * once into .cache/ and run in Docker (scripts/app/Dockerfile) under Xvfb
 * with a throwaway user data directory and the theme loaded as a
 * development extension.
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { image } from "@mistpine/port-kit/docker";

export const ROOT = join(import.meta.dirname, "..", "..");
const CACHE = join(ROOT, ".cache");

export interface App {
  /** A short name, used in paths and messages. */
  id: "vscode" | "cursor";
  name: string;
  version: string;
  /** The host directory the app is unpacked into. */
  dir: string;
  /** The Electron binary inside `dir`. */
  binary: string;
}

/** The versions the theme is checked against; bump them to test a new release. */
export const VSCODE_VERSION = "1.146.0";
/** Cursor's builds are addressed by commit (cursor.com/api/download lists the latest). */
export const CURSOR = { version: "3.30.14", commit: "5f54c8173e5552412beb40702adac16275677fa0" };

function download(url: string, file: string): void {
  console.log(`downloading ${url}`);
  execFileSync("curl", ["-fsSL", "--retry", "3", "-o", file, url], { stdio: "inherit" });
}

/** VS Code from its Linux tarball. */
export function vscode(): App {
  const dir = join(CACHE, `vscode-${VSCODE_VERSION}`);
  if (!existsSync(join(dir, "code"))) {
    mkdirSync(CACHE, { recursive: true });
    const tmp = mkdtempSync(join(CACHE, "dl-"));
    const tarball = join(tmp, "vscode.tar.gz");
    download(`https://update.code.visualstudio.com/${VSCODE_VERSION}/linux-x64/stable`, tarball);
    mkdirSync(join(tmp, "app"));
    execFileSync("tar", ["-xzf", tarball, "-C", join(tmp, "app"), "--strip-components=1"]);
    renameSync(join(tmp, "app"), dir);
    rmSync(tmp, { recursive: true, force: true });
  }
  return { id: "vscode", name: "VS Code", version: VSCODE_VERSION, dir, binary: "code" };
}

/** Cursor from its .deb, unpacked without installing it. */
export function cursor(): App {
  const { version, commit } = CURSOR;
  const dir = join(CACHE, `cursor-${version}`);
  if (!existsSync(join(dir, "cursor"))) {
    mkdirSync(CACHE, { recursive: true });
    const tmp = mkdtempSync(join(CACHE, "dl-"));
    const deb = join(tmp, "cursor.deb");
    download(
      `https://downloads.cursor.com/production/${commit}/linux/x64/deb/amd64/deb/cursor_${version}_amd64.deb`,
      deb,
    );
    execFileSync("dpkg-deb", ["-x", deb, join(tmp, "root")]);
    renameSync(join(tmp, "root", "usr", "share", "cursor"), dir);
    rmSync(tmp, { recursive: true, force: true });
  }
  return { id: "cursor", name: "Cursor", version, dir, binary: "cursor" };
}

/** The Docker image the apps run in. */
export function appImage(): string {
  return image({
    name: "mistpine-vscode",
    release: "24.04",
    context: join(ROOT, "scripts", "app"),
    hostUser: true,
  });
}

/** A fresh work directory under .render/, with a user data directory whose settings select mistpine. */
export function workDir(app: App, name: string, settings: Record<string, unknown> = {}): string {
  const dir = join(ROOT, ".render", app.id, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "user-data", "User"), { recursive: true });
  mkdirSync(join(dir, "extensions"), { recursive: true });
  writeFileSync(
    join(dir, "user-data", "User", "settings.json"),
    `${JSON.stringify(
      {
        "workbench.colorTheme": "mistpine",
        "workbench.startupEditor": "none",
        "workbench.tips.enabled": false,
        "telemetry.telemetryLevel": "off",
        "update.mode": "none",
        "extensions.autoCheckUpdates": false,
        "extensions.autoUpdate": false,
        "chat.disableAIFeatures": true,
        "security.workspace.trust.enabled": false,
        "git.openRepositoryInParentFolders": "never",
        ...settings,
      },
      null,
      2,
    )}\n`,
  );
  chmodSync(dir, 0o777);
  return dir;
}

export interface RunOptions {
  /** Extra volumes, as `host:container[:ro]`. */
  volumes?: string[];
  env?: Record<string, string>;
  /** Seconds before the container is killed. */
  timeout?: number;
}

/**
 * Runs `command` in the app's container: the repository at /repo
 * (read-only), the app at /app, `work` at /work. Xvfb is started by the
 * command (xvfb-run), so a render can pick the screen size.
 */
export function run(app: App, work: string, command: string[], options: RunOptions = {}): string {
  const env = Object.entries({ HOME: "/tmp/home", ...options.env }).flatMap(([k, v]) => [
    "-e",
    `${k}=${v}`,
  ]);
  const volumes = [
    `${ROOT}:/repo:ro`,
    `${app.dir}:/app:ro`,
    `${work}:/work`,
    ...(options.volumes ?? []),
  ].flatMap((v) => ["-v", v]);
  const result = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "--init",
      "--ipc=host",
      "--user",
      `${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`,
      ...env,
      ...volumes,
      appImage(),
      ...command,
    ],
    { encoding: "utf8", timeout: (options.timeout ?? 180) * 1000, maxBuffer: 64 * 1024 * 1024 },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  writeFileSync(join(work, "container.log"), output);
  if (result.error)
    throw new Error(`${app.name}: ${result.error.message} (log: ${join(work, "container.log")})`);
  if (result.status !== 0)
    throw new Error(
      `${app.name} exited with ${result.status} (log: ${join(work, "container.log")})`,
    );
  return output;
}

/** The app's command line: no sandbox (Docker), no GPU (Xvfb), throwaway profile. */
export function appArgs(app: App): string[] {
  return [
    `/app/${app.binary}`,
    "--no-sandbox",
    "--disable-gpu",
    "--disable-updates",
    "--skip-welcome",
    "--skip-release-notes",
    "--disable-workspace-trust",
    "--user-data-dir=/work/user-data",
    "--extensions-dir=/work/extensions",
    "--extensionDevelopmentPath=/repo",
  ];
}
