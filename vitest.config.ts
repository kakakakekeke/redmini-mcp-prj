import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 저장소 내부 워크트리(.worktrees/, .claude/worktrees/)의 테스트 사본을 수집하지 않는다. (DL-0028)
    exclude: [...configDefaults.exclude, "**/.worktrees/**", "**/.claude/worktrees/**"],
  },
});
