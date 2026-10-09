import { z } from "zod";
import { RedmineClient, AddProjectFileData } from "../client/redmine.js";
import { SmartNameResolver } from "../client/resolver.js";

// 프로젝트 "파일" 탭 (Files API, Redmine 3.4+) 조회·등록 도구. (DL-0032)
// 업로드 자체는 upload_attachment 가 담당하고, 이 도구는 발급된 토큰을 프로젝트 파일 탭에 바인딩한다.

// 표시 위장(RTL override 등)에 쓰이는 양방향 제어 문자와 NUL. 줄바꿈은 설명에서 허용한다.
const BIDI_OR_NUL = /[\u0000\u200E\u200F\u202A-\u202E\u2066-\u2069]/;

export const manageProjectFilesSchema = z.object({
  action: z
    .enum(["list", "add"])
    .describe(
      "수행할 작업: 'list' (프로젝트 파일 탭 목록 조회), 'add' (upload_attachment 로 발급받은 토큰을 프로젝트 파일 탭에 등록)"
    ),
  // get_projects 와 동일한 경로 조작 방어 규칙 (DL-0026)
  project_id: z
    .union([
      z
        .string()
        .trim()
        .min(1, "프로젝트 ID 또는 식별자는 공백일 수 없습니다.")
        .max(255, "프로젝트 ID 또는 식별자는 255자를 초과할 수 없습니다.")
        .refine((val) => !val.includes("/") && !val.includes("\\") && !val.includes(".."), {
          message: "프로젝트 ID 또는 식별자에 경로 조작 문자(/, \\, ..)가 포함될 수 없습니다.",
        }),
      z.number().int().positive("프로젝트 ID는 양의 정수여야 합니다."),
    ])
    .describe("프로젝트 ID, 식별자(identifier) 또는 프로젝트명"),
  token: z
    .string()
    .max(200, "토큰이 너무 깁니다.")
    .regex(/^\d+\.[0-9a-zA-Z]+$/, "업로드 토큰 형식이 올바르지 않습니다 (예: '7167.ed1074a1a2...').")
    .optional()
    .describe("upload_attachment 도구가 발급한 업로드 토큰 (action이 'add'일 때 필수)"),
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[^/\\:*?"<>|]+$/, "파일명에 경로 구분자(/, \\)나 금지된 특수문자를 포함할 수 없습니다")
    .refine((name) => !name.includes(".."), "경로 순회(..)는 허용되지 않습니다")
    .refine((name) => !/[\p{Cc}\p{Cf}]/u.test(name), "파일명에 제어문자나 서식(양방향 제어 등) 문자를 포함할 수 없습니다")
    .optional()
    .describe("파일 탭에 표시할 파일명 (선택, 생략 시 업로드 시점의 파일명 사용)"),
  description: z
    .string()
    .max(255, "설명은 255자를 초과할 수 없습니다.")
    .refine((d) => !BIDI_OR_NUL.test(d), "설명에 NUL 이나 양방향 제어 문자를 포함할 수 없습니다")
    .optional()
    .describe("파일 설명 (선택)"),
  version_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("연결할 버전(마일스톤) ID (선택, version 과 동시 지정 불가)"),
  version: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .describe("연결할 버전(마일스톤) 이름 (선택, 대소문자 무시로 프로젝트 버전 목록에서 ID를 자동 매핑, version_id 와 동시 지정 불가)"),
  dry_run: z
    .boolean()
    .default(true)
    .describe(
      "기본값이 true이며 안전을 위해 미리보기를 제공합니다. 실제로 파일을 등록할 경우에만 명시적으로 false로 전달하세요."
    ),
});

export type ManageProjectFilesArgs = z.infer<typeof manageProjectFilesSchema>;

async function resolveProjectId(projectId: string | number, client: RedmineClient): Promise<string | number> {
  if (typeof projectId !== "string" || /^\d+$/.test(projectId)) {
    return projectId;
  }
  const resolver = (client as any).resolver ?? new SmartNameResolver(client);
  (client as any).resolver = resolver;
  await resolver.load();
  return resolver.resolveProject(projectId) ?? projectId;
}

type ErrorResult = { error: string; available_versions?: string[] };

function isErrorResult(v: unknown): v is ErrorResult {
  return typeof v === "object" && v !== null && "error" in v;
}

// Files API 는 해당 프로젝트 소유 버전만 받는다(@project.versions). 공유 버전과 구별하려면 숫자 project id 가 필요하다.
async function toNumericProjectId(projectId: string | number, client: RedmineClient): Promise<number | undefined> {
  if (typeof projectId === "number") return projectId;
  if (/^\d+$/.test(projectId)) return Number(projectId);
  const data = await client.getProject(projectId, { include: "" });
  const id = data?.project?.id;
  return typeof id === "number" ? id : undefined;
}

type ResolvedVersion = { id: number; ownershipVerified: boolean };

// Redmine 데이터(버전 이름)를 담는 결과는 예외가 아닌 객체로 반환해 processToolResult(인젝션 탐지)를 거치게 한다.
// ownershipVerified: 숫자 project id 를 확인해 "이 프로젝트 소유 버전" 으로 걸러낸 결과인지 여부.
async function resolveVersionId(
  versionName: string,
  projectId: string | number,
  client: RedmineClient
): Promise<ResolvedVersion | ErrorResult> {
  const data = await client.getProjectVersions(projectId);
  const versions: any[] = Array.isArray(data?.versions) ? data.versions : [];
  const numericProjectId = await toNumericProjectId(projectId, client);
  const owned =
    numericProjectId === undefined ? versions : versions.filter((v) => v?.project?.id === numericProjectId);
  const ownedNames = owned.map((v) => v?.name).filter((n): n is string => typeof n === "string");

  const key = versionName.toLowerCase();
  const isMatch = (v: any) => typeof v?.name === "string" && v.name.trim().toLowerCase() === key;
  const matches = owned.filter(isMatch);

  if (matches.length === 0) {
    if (versions.some(isMatch)) {
      return {
        error: `Version '${versionName}' is a shared version owned by another project. Project files can only be linked to versions owned by this project (프로젝트 소유 버전만 연결 가능).`,
        available_versions: ownedNames,
      };
    }
    return { error: `Version '${versionName}' not found in project.`, available_versions: ownedNames };
  }
  if (matches.length > 1) {
    return {
      error: `Version name '${versionName}' is ambiguous (ids: ${matches.map((v) => v.id).join(", ")}). Please specify version_id.`,
    };
  }
  return { id: matches[0].id, ownershipVerified: numericProjectId !== undefined };
}

function maskToken(token: string): string {
  const [id, digest = ""] = token.split(".");
  return `${id}.${digest.slice(0, 4)}…`;
}

function toFriendlyError(error: any, projectId: string | number): ErrorResult | undefined {
  const status = error?.response?.status;
  if (status === 404) {
    return { error: `해당 프로젝트를 찾을 수 없습니다: ${projectId}` };
  }
  if (status === 403) {
    return {
      error: "해당 프로젝트 파일에 접근할 권한이 없거나 파일 모듈이 비활성화되어 있습니다 (403 Forbidden)",
    };
  }
  return undefined;
}

// Redmine FilesController 는 무효·만료된 업로드 토큰도 404(빈 본문)로 응답하므로(라이브 검증),
// add 의 404 를 "프로젝트 없음" 으로 단정하지 않고 가능한 원인을 함께 안내한다. 토큰 원문은 넣지 않는다.
function addNotFoundError(
  projectId: string | number,
  opts: { projectConfirmed: boolean; versionUnverified: boolean }
): ErrorResult {
  const causes = [
    "업로드 토큰(token)이 유효하지 않거나 만료되었거나 이미 사용됨 → upload_attachment 로 다시 업로드해 새 토큰을 발급받으세요",
  ];
  if (!opts.projectConfirmed) {
    causes.push(`프로젝트를 찾을 수 없음: ${projectId}`);
  }
  if (opts.versionUnverified) {
    causes.push("지정한 버전이 없거나 이 프로젝트 소유가 아님 (공유 버전은 연결 불가)");
  }
  const header = opts.projectConfirmed
    ? `파일 등록 실패 (404 Not Found, 프로젝트 ${projectId} 는 확인됨). 가능한 원인: `
    : "파일 등록 실패 (404 Not Found). 가능한 원인: ";
  return { error: header + causes.map((c, i) => `(${i + 1}) ${c}`).join(" / ") };
}

export async function manageProjectFilesHandler(args: ManageProjectFilesArgs, client: RedmineClient) {
  if (args.action === "list") {
    const projectId = await resolveProjectId(args.project_id, client);
    try {
      return await client.getProjectFiles(projectId);
    } catch (error: any) {
      const friendly = toFriendlyError(error, args.project_id);
      if (friendly) return friendly;
      throw error;
    }
  }

  if (args.action === "add") {
    if (!args.token) {
      throw new Error("token is required for add action (obtain it with upload_attachment)");
    }
    if (args.version_id !== undefined && args.version !== undefined) {
      throw new Error("Specify only one of version_id or version");
    }

    const projectId = await resolveProjectId(args.project_id, client);

    const file: AddProjectFileData = { token: args.token };
    if (args.filename !== undefined) file.filename = args.filename;
    if (args.description !== undefined) file.description = args.description;
    // add 의 404 원인 안내용: 버전 이름 해석(getProjectVersions 성공)으로 이미 확인된 사실 (추가 API 호출 없음)
    let projectConfirmed = false;
    let versionOwnershipVerified = false;
    if (args.version_id !== undefined) {
      file.version_id = args.version_id;
    } else if (args.version !== undefined) {
      let resolved: ResolvedVersion | ErrorResult;
      try {
        resolved = await resolveVersionId(args.version, projectId, client);
      } catch (error: any) {
        const friendly = toFriendlyError(error, args.project_id);
        if (friendly) return friendly;
        throw error;
      }
      if (isErrorResult(resolved)) return resolved;
      file.version_id = resolved.id;
      projectConfirmed = true;
      versionOwnershipVerified = resolved.ownershipVerified;
    }

    if (args.dry_run !== false) {
      return {
        message: "dry_run is true. File will not be registered. Please confirm with user.",
        dry_run: true,
        payload: {
          action: "add",
          project_id: projectId,
          // 미리보기에는 토큰 원문을 노출하지 않는다 (대화 기록 공유 시 바인딩 탈취 방지)
          file: { ...file, token: maskToken(file.token) },
        },
      };
    }

    try {
      return await client.addProjectFile(projectId, file);
    } catch (error: any) {
      const status = error?.response?.status;
      // 방어 코드: FilesController 는 422 를 내지 않지만 버전·플러그인 차이에 대비한다
      if (status === 422 && Array.isArray(error.response?.data?.errors)) {
        return { error: `파일 등록 실패 (422): ${error.response.data.errors.join(", ")}` };
      }
      // 방어 코드: 라이브 실측상 무효·만료 토큰은 404 로 오며(addNotFoundError), 400 은 버전·플러그인 차이 대비용
      if (status === 400) {
        return {
          error:
            "파일 등록 실패 (400 Bad Request): 업로드 토큰(token)이 유효하지 않거나 만료되었을 수 있습니다. upload_attachment 로 다시 업로드하세요.",
        };
      }
      if (status === 404) {
        return addNotFoundError(args.project_id, {
          projectConfirmed,
          versionUnverified: file.version_id !== undefined && !versionOwnershipVerified,
        });
      }
      const friendly = toFriendlyError(error, args.project_id);
      if (friendly) return friendly;
      throw error;
    }
  }

  throw new Error(`Unsupported action: ${(args as any).action}`);
}
