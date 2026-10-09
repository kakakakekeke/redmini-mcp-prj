import { spawn, ChildProcess } from "child_process";
import net from "net";

/** OS 에 임시 포트(0)를 요청해 현재 비어 있는 포트 번호를 얻는다. */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

export interface SpawnedServer {
  child: ChildProcess;
  port: number;
  baseUrl: string;
  stop: () => Promise<void>;
}

/**
 * src/index.ts 를 HTTP 모드로 띄우고 /health 가 200 을 돌려줄 때까지 폴링한다.
 * npx 를 거치지 않고 현재 node 에 tsx 로더를 붙여 직접 실행하므로 손자 프로세스가 생기지 않아
 * kill 시 포트가 확실히 해제된다.
 */
export async function startHttpServer(
  entry: string,
  env: Record<string, string>,
  { timeoutMs = 15000, intervalMs = 100 } = {}
): Promise<SpawnedServer> {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, ["--import", "tsx", entry], {
    env: { ...process.env, ...env, TRANSPORT: "http", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  const capture = (chunk: Buffer) => {
    output = (output + chunk.toString()).slice(-8192);
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);

  const exited = new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once("exit", () => resolve());
  });

  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
      await exited;
      clearTimeout(timer);
    }
  };

  const deadline = Date.now() + timeoutMs;
  try {
    while (true) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(
          `서버 프로세스가 준비 전에 종료되었습니다 (code=${child.exitCode}, signal=${child.signalCode}, port=${port}).\n${output}`
        );
      }
      try {
        const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1000) });
        if (res.status === 200) break;
      } catch {
        // 아직 listen 전 — 재시도
      }
      if (Date.now() > deadline) {
        throw new Error(`서버가 ${timeoutMs}ms 안에 ${baseUrl}/health 에 응답하지 않았습니다.\n${output}`);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  } catch (err) {
    await stop();
    throw err;
  }

  return { child, port, baseUrl, stop };
}
