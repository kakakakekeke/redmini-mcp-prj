import { RedmineClient } from "./redmine.js";

/** 저장된 필터(Queries) 요약. project_id 가 없으면 전역(모든 프로젝트) 필터. DL-0031 */
export interface SavedQuery {
  id: number;
  name: string;
  is_public?: boolean;
  project_id?: number;
}

export type SavedQueryResolution =
  | { status: "resolved"; query: SavedQuery }
  /** 정확히 일치하는 이름이 없음. candidates 는 부분 일치 항목만 (관련 없는 외부 텍스트 노출 최소화) */
  | { status: "not_found"; candidates: SavedQuery[] }
  | { status: "ambiguous"; candidates: SavedQuery[] }
  /** 지정한 프로젝트에서 쓸 수 없는(다른 프로젝트 전용) 필터만 일치. Redmine 은 이 조합에 404 를 낸다. */
  | { status: "other_project"; candidates: SavedQuery[] };

/**
 * 외부(Redmine 사용자 입력) 텍스트 정제: 제어문자·줄/문단 구분자는 공백으로, 보이지 않는 서식 문자
 * (zero-width, bidi override, Unicode Tag 등 \p{Cf})·사용자 정의·미할당 코드포인트는 제거한다.
 * 프롬프트 주입 탐지 우회와 숨은 지시문을 막기 위해 탐지·표시·매칭 모두 정제된 문자열을 쓴다. (DL-0031)
 */
export function cleanExternalText(text: string): string {
  return text
    .replace(/[\p{Cf}\p{Co}\p{Cn}]/gu, "")
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, " ")
    .trim();
}

/** 대소문자·앞뒤 공백·유니코드 정규화(NFC/NFD)·보이지 않는 문자 차이를 무시하는 비교 키 */
export function normalizeName(name: string): string {
  return cleanExternalText(name.normalize("NFC")).toLowerCase();
}

/** API 응답의 필터 항목을 검증·축약한다. 형식이 맞지 않으면 undefined. */
export function toSavedQuery(raw: unknown): SavedQuery | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const q = raw as Record<string, unknown>;
  if (typeof q.id !== "number" || !Number.isInteger(q.id) || q.id <= 0) return undefined;
  if (typeof q.name !== "string") return undefined;
  const projectId =
    typeof q.project_id === "number" && Number.isInteger(q.project_id) && q.project_id > 0 ? q.project_id : undefined;
  return {
    id: q.id,
    name: cleanExternalText(q.name),
    is_public: typeof q.is_public === "boolean" ? q.is_public : undefined,
    project_id: projectId,
  };
}

export class SmartNameResolver {
  private client: RedmineClient;
  private cacheTtlMs: number;
  private lastLoadedAt = 0;

  private projects: Record<string, number> = {};
  private trackers: Record<string, number> = {};
  private statuses: Record<string, number> = {};
  private priorities: Record<string, number> = {};
  private users: Record<string, number> = {};
  private activities: Record<string, number> = {};

  // 저장된 필터는 이름 중복이 가능하고(프로젝트별) 필요할 때만 쓰이므로 load() 와 분리해 지연 로드한다.
  private savedQueries: SavedQuery[] = [];
  private savedQueriesLoadedAt = 0;
  private savedQueriesTruncatedFlag = false;

  constructor(client: RedmineClient, cacheTtlMs: number = 300_000) {
    this.client = client;
    this.cacheTtlMs = cacheTtlMs;
  }

  async load(force: boolean = false) {
    if (!force && this.lastLoadedAt > 0 && (Date.now() - this.lastLoadedAt) < this.cacheTtlMs) {
      return;
    }

    const fetchPromises: Promise<any>[] = [
      this.client.getProjects(),
      this.client.getTrackers(),
      this.client.getStatuses(),
      this.client.getPriorities(),
      this.client.getUsers()
    ];
    if (typeof this.client.getTimeEntryActivities === "function") {
      fetchPromises.push(this.client.getTimeEntryActivities());
    }

    const results = await Promise.allSettled(fetchPromises);

    this.projects = {};
    if (results[0].status === "fulfilled" && results[0].value) {
      for (const p of results[0].value.projects || []) {
        this.projects[p.name.toLowerCase()] = p.id;
        if (p.identifier) {
          this.projects[p.identifier.toLowerCase()] = p.id;
        }
      }
    }

    this.trackers = {};
    if (results[1].status === "fulfilled" && results[1].value) {
      for (const t of results[1].value.trackers || []) {
        this.trackers[t.name.toLowerCase()] = t.id;
      }
    }

    this.statuses = {};
    if (results[2].status === "fulfilled" && results[2].value) {
      for (const s of results[2].value.issue_statuses || []) {
        this.statuses[s.name.toLowerCase()] = s.id;
      }
    }

    this.priorities = {};
    if (results[3].status === "fulfilled" && results[3].value) {
      for (const p of results[3].value.issue_priorities || []) {
        this.priorities[p.name.toLowerCase()] = p.id;
      }
    }

    this.users = {};
    if (results[4].status === "fulfilled" && results[4].value) {
      for (const u of results[4].value.users || []) {
        this.users[`${u.firstname} ${u.lastname}`.toLowerCase()] = u.id;
        if (u.login) {
          this.users[u.login.toLowerCase()] = u.id;
        }
      }
    }

    this.activities = {};
    if (results[5] && results[5].status === "fulfilled" && results[5].value) {
      for (const a of results[5].value.time_entry_activities || []) {
        this.activities[a.name.toLowerCase()] = a.id;
      }
    }

    this.lastLoadedAt = Date.now();
  }

  clearCache() {
    this.lastLoadedAt = 0;
    this.savedQueriesLoadedAt = 0;
  }

  /** 저장된 필터 목록을 TTL 캐시로 로드한다. 조회 실패는 호출자에게 그대로 전파한다. */
  async loadSavedQueries(force: boolean = false) {
    if (!force && this.savedQueriesLoadedAt > 0 && (Date.now() - this.savedQueriesLoadedAt) < this.cacheTtlMs) {
      return;
    }
    const data = await this.client.getAllQueries();
    const raw: unknown[] = Array.isArray(data?.queries) ? data.queries : [];
    // 페이지 사이에 필터가 추가·삭제되면 같은 항목이 두 번 올 수 있으므로 id 로 중복 제거한다
    const seen = new Set<number>();
    this.savedQueries = [];
    for (const q of raw.map(toSavedQuery)) {
      if (q === undefined || seen.has(q.id)) continue;
      seen.add(q.id);
      this.savedQueries.push(q);
    }
    this.savedQueriesTruncatedFlag = data?.truncated === true;
    this.savedQueriesLoadedAt = Date.now();
  }

  /** 페이지 상한 때문에 필터 목록이 잘렸는지 여부 */
  get savedQueriesTruncated(): boolean {
    return this.savedQueriesTruncatedFlag;
  }

  getSavedQueries(): SavedQuery[] {
    return [...this.savedQueries];
  }

  /**
   * 필터 이름을 ID 로 해석한다.
   * Redmine 은 query_id 를 "전역 필터 + 요청 project_id 의 필터" 범위에서만 찾으므로(그 외는 404),
   * projectId 가 있으면 ① 해당 프로젝트 필터 → ② 전역 필터 순으로 고르고, 다른 프로젝트 전용 필터만 있으면 other_project.
   * projectId 가 없으면 유일한 일치를 그대로 쓰되(프로젝트 전용이면 호출자가 그 프로젝트로 범위를 지정),
   * 여럿이면 전역 필터가 유일할 때만 고른다.
   */
  resolveSavedQuery(name: string, projectId?: number): SavedQueryResolution {
    const key = typeof name === "string" ? normalizeName(name) : "";
    const matches = key ? this.savedQueries.filter((q) => normalizeName(q.name) === key) : [];

    if (matches.length === 0) {
      const partial = key ? this.savedQueries.filter((q) => normalizeName(q.name).includes(key)) : [];
      return { status: "not_found", candidates: partial };
    }

    const global = matches.filter((q) => q.project_id === undefined);

    if (projectId !== undefined) {
      const inProject = matches.filter((q) => q.project_id === projectId);
      if (inProject.length === 1) return { status: "resolved", query: inProject[0] };
      if (inProject.length > 1) return { status: "ambiguous", candidates: inProject };
      if (global.length === 1) return { status: "resolved", query: global[0] };
      if (global.length > 1) return { status: "ambiguous", candidates: global };
      return { status: "other_project", candidates: matches };
    }

    if (matches.length === 1) return { status: "resolved", query: matches[0] };
    if (global.length === 1) return { status: "resolved", query: global[0] };
    if (global.length > 1) return { status: "ambiguous", candidates: global };
    return { status: "ambiguous", candidates: matches };
  }

  resolveProject(name: string): number | undefined {
    if (!name) return undefined;
    const key = name.toLowerCase();
    return Object.hasOwn(this.projects, key) && typeof this.projects[key] === "number" ? this.projects[key] : undefined;
  }

  resolveTracker(name: string): number | undefined {
    if (!name) return undefined;
    const key = name.toLowerCase();
    return Object.hasOwn(this.trackers, key) && typeof this.trackers[key] === "number" ? this.trackers[key] : undefined;
  }

  resolveStatus(name: string): number | undefined {
    if (!name) return undefined;
    const key = name.toLowerCase();
    return Object.hasOwn(this.statuses, key) && typeof this.statuses[key] === "number" ? this.statuses[key] : undefined;
  }

  resolvePriority(name: string): number | undefined {
    if (!name) return undefined;
    const key = name.toLowerCase();
    return Object.hasOwn(this.priorities, key) && typeof this.priorities[key] === "number" ? this.priorities[key] : undefined;
  }

  resolveUser(name: string): number | undefined {
    if (!name) return undefined;
    const key = name.toLowerCase();
    return Object.hasOwn(this.users, key) && typeof this.users[key] === "number" ? this.users[key] : undefined;
  }

  resolveActivity(name: string): number | undefined {
    if (!name) return undefined;
    const key = name.toLowerCase();
    return Object.hasOwn(this.activities, key) && typeof this.activities[key] === "number" ? this.activities[key] : undefined;
  }
}
