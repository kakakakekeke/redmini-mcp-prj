// server-process 헬퍼 테스트용 픽스처.
// FLAKY_MARKER 파일에 기록된 실행 횟수가 FLAKY_FAILS 미만이면 준비 전에 종료(포트 경합 모사)하고,
// 그 이후에는 PORT 에서 /health 를 제공한다.
import fs from "node:fs";
import http from "node:http";

const marker = process.env.FLAKY_MARKER;
const fails = Number(process.env.FLAKY_FAILS ?? "0");
const count = marker && fs.existsSync(marker) ? Number(fs.readFileSync(marker, "utf8")) : 0;
if (marker) fs.writeFileSync(marker, String(count + 1));

if (count < fails) {
  console.error(`flaky-server: simulated early exit #${count + 1}`);
  process.exit(1);
}

http
  .createServer((req, res) => {
    res.writeHead(req.url === "/health" ? 200 : 404, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  })
  .listen(Number(process.env.PORT));
