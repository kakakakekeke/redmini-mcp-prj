import { spawn, ChildProcess } from "child_process";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";

/** 저장소 루트. tsx 로더 해석이 호출자의 cwd 에 좌우되지 않도록 자식 프로세스의 cwd 로 쓴다. */
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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

export interface StartOptions {
  /** 시도 1회당 /health 폴링 제한 시간 */
  timeoutMs?: number;
  intervalMs?: number;
  /** 준비 전 종료(포트 경합 등) 시 새 포트로 다시 띄우는 최대 시도 횟수 */
  attempts?: number;
  cwd?: string;
}

/**
 * 엔트리를 HTTP 모드로 띄우고 /health 가 200 을 돌려줄 때까지 폴링한다.
 * - 빈 포트를 고른 뒤 넘기므로, 그 사이 다른 프로세스가 포트를 가져가면 자식이 종료된다 → 새 포트로 재시도.
 * - npx 를 거치지 않고 현재 node 에 tsx 로더를 붙여 직접 실행하므로 손자 프로세스가 생기지 않는다.
 * 최악 소요 시간 ≈ attempts × (timeoutMs + 5s 종료 대기).
 */
export async function startHttpServer(
  entry: string,
  env: Record<string, string>,
  { timeoutMs = 10000, intervalMs = 100, attempts = 3, cwd = PROJECT_ROOT }: StartOptions = {}
): Promise<SpawnedServer> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await startOnce(entry, env, { timeoutMs, intervalMs, cwd });
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw new Error(`서버 기동에 ${attempts}회 시도 모두 실패했습니다. 마지막 오류: ${lastError?.message}`);
}

async function startOnce(
  entry: string,
  env: Record<string, string>,
  { timeoutMs, intervalMs, cwd }: Required<Omit<StartOptions, "attempts">>
): Promise<SpawnedServer> {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, ["--import", "tsx", entry], {
    cwd,
    env: { ...process.env, ...env, TRANSPORT: "http", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  const capture = (text: string) => {
    output = (output + text).slice(-8192);
  };
  child.stdout?.on("data", (chunk: Buffer) => capture(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => capture(chunk.toString()));

  let done = false;
  let spawnError: Error | undefined;
  const exited = new Promise<void>((resolve) => {
    const finish = () => {
      done = true;
      resolve();
    };
    child.once("exit", finish);
    // spawn 실패(ENOENT 등)는 exit 없이 error 만 올 수 있다 — stop() 이 멈추지 않도록 여기서도 완료 처리
    child.once("error", (err) => {
      spawnError = err;
      capture(`\n[spawn error] ${err.message}`);
      finish();
    });
  });

  const stop = async () => {
    if (!done) {
      child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
      await exited;
      clearTimeout(timer);
    }
  };

  const deadline = Date.now() + timeoutMs;
  try {
    while (true) {
      if (done) {
        throw new Error(
          `서버 프로세스가 준비 전에 종료되었습니다 (code=${child.exitCode}, signal=${child.signalCode}, ` +
            `error=${spawnError?.message ?? "none"}, port=${port}).\n${output}`
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
