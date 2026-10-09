import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 저장소 내부 워크트리(.worktrees/, .claude/worktrees/)의 테스트 사본을 수집하지 않는다. (DL-0028)
    exclude: [...configDefaults.exclude, "**/.worktrees/**", "**/.claude/worktrees/**"],
    // 커버리지 기준선: 측정값(2026-10-09)의 정수 내림. 하락하면 `npm test`(pre-commit 포함)가 실패한다.
    // 커버리지를 올렸다면 기준선도 함께 올린다. (DL-0029)
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text-summary"],
      thresholds: { statements: 84, branches: 83, functions: 74, lines: 84 },
    },
  },
});
