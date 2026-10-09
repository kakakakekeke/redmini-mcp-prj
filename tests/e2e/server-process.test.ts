import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { startHttpServer, SpawnedServer } from "./server-process.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FLAKY = path.resolve(__dirname, "fixtures/flaky-server.mjs");

describe("e2e server-process 헬퍼", () => {
  let server: SpawnedServer | undefined;
  let tmpDir: string | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  });

  const marker = () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "srvproc-"));
    return path.join(tmpDir, "count");
  };

  it("준비 전에 종료되면 새 포트로 재시도해 기동에 성공한다", async () => {
    const m = marker();
    server = await startHttpServer(FLAKY, { FLAKY_MARKER: m, FLAKY_FAILS: "2" }, { attempts: 3 });
    expect(fs.readFileSync(m, "utf8")).toBe("3");
    const res = await fetch(`${server.baseUrl}/health`);
    expect(res.status).toBe(200);
  });

  it("모든 시도가 실패하면 시도 횟수와 마지막 출력이 담긴 에러를 던진다", async () => {
    const m = marker();
    await expect(
      startHttpServer(FLAKY, { FLAKY_MARKER: m, FLAKY_FAILS: "99" }, { attempts: 2 })
    ).rejects.toThrow(/2회 시도[\s\S]*simulated early exit #2/);
    expect(fs.readFileSync(m, "utf8")).toBe("2");
  });

  it("spawn 자체가 실패(error 이벤트)해도 멈추지 않고 에러를 던진다", async () => {
    await expect(
      startHttpServer(FLAKY, {}, { attempts: 1, cwd: "/nonexistent-dir-for-spawn-error" })
    ).rejects.toThrow(/ENOENT/);
  }, 10000);

  it("stop() 후 프로세스가 종료되어 포트가 해제된다", async () => {
    server = await startHttpServer(FLAKY, {});
    const { child, baseUrl } = server;
    await server.stop();
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
    await expect(fetch(`${baseUrl}/health`)).rejects.toThrow();
  });
});
