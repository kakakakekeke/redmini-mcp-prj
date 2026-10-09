import { z } from "zod";
import type { RedmineClient } from "../client/redmine.js";
import { cleanExternalText, normalizeName } from "../client/resolver.js";
import { detectPromptInjection } from "./prompt_injection_detector.js";

/**
 * 일감 커스텀 필드 값 입력 (create_issue / update_issue 공용). DL-0035
 *
 * - 키: 필드 이름 또는 숫자 ID 문자열. 숫자로만 된 키는 항상 ID 로 해석한다.
 * - 이름 → ID: 프로젝트의 issue_custom_fields(GET /projects/{id}.json?include=issue_custom_fields)로 해석.
 * - 값 사전 검증: GET /custom_fields.json(관리자 전용)이 되면 목록 허용값·다중 선택·트래커를 검사하고,
 *   실패(403 등)하면 건너뛰고 Redmine 422 응답에 맡긴다(graceful degradation).
 * - regexp 는 관리자 정의 패턴을 이벤트 루프에서 실행하면 ReDoS 위험이 있어 실행하지 않고 Redmine 에 맡긴다.
 */

const MAX_ENTRIES = 50;
const MAX_ALLOWED_VALUES_IN_ERROR = 100;
/** 필드당 처리할 허용값 상한 (대형 정의 응답 방어) */
const MAX_POSSIBLE_VALUES = 1000;
/** 허용값 검사를 하는 형식. user·version 은 /custom_fields.json 의 possible_values 가 프로젝트 문맥 없이 계산되어 신뢰할 수 없다. */
const POSSIBLE_VALUE_FORMATS = new Set(["list", "enumeration", "bool"]);
const MAX_REDMINE_MESSAGE_LENGTH = 2000;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const customFieldKeySchema = z
  .string()
  .max(255)
  .refine((k) => k.trim().length > 0, "custom field key must not be blank")
  .refine((k) => !FORBIDDEN_KEYS.has(k.trim()), "reserved key is not allowed");

/** 지수 표기(1e21, 1e-7)는 String() 결과가 Redmine 정수/실수 형식과 맞지 않으므로 거부한다 */
const plainNumberSchema = z
  .number()
  .finite()
  .refine((n) => !/e/i.test(String(n)), "number must not require exponent notation");

const customFieldValueSchema = z.union([
  z.string().max(65535),
  plainNumberSchema,
  z.boolean(),
  z.array(z.union([z.string().max(1024), plainNumberSchema])).max(100),
]);

export const customFieldsInputSchema = z
  .record(customFieldKeySchema, customFieldValueSchema)
  .refine((o) => {
    const n = Object.keys(o).length;
    return n >= 1 && n <= MAX_ENTRIES;
  }, `custom_fields must have 1-${MAX_ENTRIES} entries`)
  .describe(
    "일감 커스텀 필드 값. 키는 필드 이름(대소문자·앞뒤 공백 무시) 또는 숫자 ID 문자열, 값은 문자열·숫자·불리언(1/0), 다중 선택 필드는 배열. " +
      "빈 문자열/빈 배열은 값 비우기. 사용자·버전 형식 필드는 숫자 ID 를 넣으세요. 프로젝트에서 쓸 수 있는 필드는 get_projects(project_id) 의 issue_custom_fields 로 확인. " +
      '예: {"고객사": "A사", "12": "REQ-1", "영향범위": ["웹", "API"]}'
  );

export type CustomFieldsInput = z.infer<typeof customFieldsInputSchema>;
export type CustomFieldValue = string | string[];

export interface ResolvedCustomField {
  id: number;
  /** Redmine 필드 이름 (cleanExternalText 로 정제됨) */
  name: string;
  value: CustomFieldValue;
}

export interface SkippedCheck {
  id: number;
  check: "regexp" | "definition" | "tracker";
  reason: string;
  /** check=regexp 일 때 Redmine 이 적용할 형식(정제됨). LLM 이 스스로 맞춰 볼 수 있게 보여 준다. */
  regexp?: string;
}

export interface CustomFieldValidationInfo {
  /** 관리자 정의(GET /custom_fields.json)로 사전 검증했는지 여부 */
  performed: boolean;
  reason?: string;
  skipped_checks?: SkippedCheck[];
}

export interface CustomFieldValueError {
  id: number;
  name: string;
  value: CustomFieldValue;
  problem: string;
  allowed_values?: string[];
  allowed_values_truncated?: boolean;
}

export interface CustomFieldResolution {
  /** 표시용 (이름·값 모두 정제됨) */
  fields: ResolvedCustomField[];
  /** Redmine 으로 보낼 페이로드 (허용값 치환 결과는 원문 그대로) */
  payload: { id: number; value: CustomFieldValue }[];
  validation: CustomFieldValidationInfo;
  errors: CustomFieldValueError[];
}

interface ProjectField {
  id: number;
  name: string;
}

interface PossibleValue {
  value: string;
  label: string;
}

interface FieldDefinition {
  id: number;
  format: string;
  multiple: boolean;
  regexp: string;
  possibleValues: PossibleValue[];
  trackerIds?: number[];
}

function isPositiveSafeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0;
}

function httpStatus(error: any): number | undefined {
  const status = error?.response?.status;
  return typeof status === "number" ? status : undefined;
}

async function fetchProjectFields(client: RedmineClient, projectId: string | number): Promise<ProjectField[]> {
  let data: any;
  try {
    data = await client.getProject(projectId, { include: "issue_custom_fields" });
  } catch (error: any) {
    const status = httpStatus(error);
    if (status === 403 || status === 404) {
      throw new Error(
        `Cannot resolve custom fields: project not found or no permission (HTTP ${status}).`
      );
    }
    throw error;
  }
  const raw = Array.isArray(data?.project?.issue_custom_fields) ? data.project.issue_custom_fields : [];
  const fields: ProjectField[] = [];
  for (const f of raw) {
    if (f && isPositiveSafeInt(f.id) && typeof f.name === "string") {
      fields.push({ id: f.id, name: cleanExternalText(f.name) });
    }
  }
  return fields;
}

type DefinitionsResult = { defs: Map<number, FieldDefinition> } | { skippedReason: string };

async function fetchDefinitions(client: RedmineClient): Promise<DefinitionsResult> {
  let data: any;
  try {
    data = await client.getCustomFields();
  } catch (error: any) {
    // 사전 검증은 부가 기능이므로 어떤 실패든 쓰기를 막지 않는다. 사유에는 상태 코드만 넣는다.
    const status = httpStatus(error);
    const why =
      status === 401 || status === 403
        ? `HTTP ${status}; administrator privileges required`
        : status !== undefined
          ? `HTTP ${status}`
          : "request failed";
    return {
      skippedReason: `GET /custom_fields.json is not available (${why}). Values were not pre-validated; Redmine validates them on submit.`,
    };
  }
  if (!Array.isArray(data?.custom_fields)) {
    return { skippedReason: "Unexpected /custom_fields.json response. Values were not pre-validated; Redmine validates them on submit." };
  }
  const defs = new Map<number, FieldDefinition>();
  for (const d of data.custom_fields) {
    if (!d || !isPositiveSafeInt(d.id)) continue;
    if (d.customized_type !== undefined && d.customized_type !== "issue") continue;
    const possibleValues: PossibleValue[] = [];
    if (Array.isArray(d.possible_values)) {
      for (const pv of d.possible_values.slice(0, MAX_POSSIBLE_VALUES)) {
        if (!pv || (typeof pv.value !== "string" && typeof pv.value !== "number")) continue;
        const value = String(pv.value);
        const label = typeof pv.label === "string" ? pv.label : value;
        possibleValues.push({ value, label });
      }
    }
    const trackerIds = Array.isArray(d.trackers)
      ? d.trackers.map((t: any) => t?.id).filter(isPositiveSafeInt)
      : undefined;
    defs.set(d.id, {
      id: d.id,
      format: typeof d.field_format === "string" ? d.field_format : "",
      multiple: d.multiple === true,
      regexp: typeof d.regexp === "string" ? d.regexp : "",
      possibleValues,
      trackerIds,
    });
  }
  return { defs };
}

/** 키 → 프로젝트 필드. Redmine 데이터(필드 이름)는 예외 메시지에 넣지 않는다 (DL-0033 범주 에러 방식). */
function resolveKey(key: string, fields: ProjectField[]): ProjectField {
  if (/^\d+$/.test(key)) {
    const id = Number(key);
    const found = isPositiveSafeInt(id) ? fields.find((f) => f.id === id) : undefined;
    if (!found) {
      throw new Error(
        `Custom field id ${key} is not available for this project. Check issue_custom_fields with get_projects (project_id).`
      );
    }
    return found;
  }
  const exact = fields.filter((f) => f.name === key);
  if (exact.length === 1) return exact[0];
  const norm = normalizeName(key);
  const matches = fields.filter((f) => normalizeName(f.name) === norm);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous custom field name: ${JSON.stringify(key)}. Multiple fields differ only by case; use the numeric id (see get_projects issue_custom_fields).`
    );
  }
  throw new Error(
    `Invalid custom field name: ${JSON.stringify(key)}. Check issue_custom_fields with get_projects (project_id) or pass the numeric id as the key.`
  );
}

/** 목록 허용값 매칭: 값 정확 일치 → 라벨 정확 일치 → 정규화(대소문자·공백) 일치가 유일할 때. 표준 값을 돌려준다. */
function matchPossibleValue(input: string, values: PossibleValue[]): string | undefined {
  const byValue = values.find((pv) => pv.value === input);
  if (byValue) return byValue.value;
  const byLabel = values.filter((pv) => pv.label === input);
  if (byLabel.length === 1) return byLabel[0].value;
  const norm = normalizeName(input);
  if (!norm) return undefined;
  const loose = values.filter((pv) => normalizeName(pv.value) === norm || normalizeName(pv.label) === norm);
  return loose.length === 1 ? loose[0].value : undefined;
}

function validateField(
  field: ResolvedCustomField,
  def: FieldDefinition,
  trackerId: number | undefined,
  skipped: SkippedCheck[]
): { value: CustomFieldValue; error?: CustomFieldValueError } {
  const base = { id: field.id, name: field.name, value: field.value };

  if (def.trackerIds !== undefined) {
    if (trackerId === undefined) {
      skipped.push({ id: field.id, check: "tracker", reason: "tracker not specified; project default tracker is not checked" });
    } else if (!def.trackerIds.includes(trackerId)) {
      return {
        value: field.value,
        error: { ...base, problem: `Custom field id ${field.id} is not enabled for tracker id ${trackerId}; Redmine would silently ignore the value.` },
      };
    }
  }

  let value = field.value;
  if (Array.isArray(value) && !def.multiple) {
    // 단일값 필드: [] 는 값 비우기, 원소 하나는 그 값으로 푼다
    if (value.length === 0) value = "";
    else if (value.length === 1) value = value[0];
    else {
      return {
        value: field.value,
        error: { ...base, problem: `Custom field id ${field.id} does not accept multiple values; pass a single string.` },
      };
    }
  }

  const items = Array.isArray(value) ? value : [value];
  let canonical: string[] = items;

  if (POSSIBLE_VALUE_FORMATS.has(def.format) && def.possibleValues.length > 0) {
    canonical = [];
    for (const item of items) {
      if (item === "") {
        canonical.push(item);
        continue;
      }
      const matched = matchPossibleValue(item, def.possibleValues);
      if (matched === undefined) {
        const labels = def.possibleValues.map((pv) => cleanExternalText(pv.label));
        const error: CustomFieldValueError = {
          ...base,
          problem: `Value ${JSON.stringify(item)} is not one of the allowed values for custom field id ${field.id}.`,
          allowed_values: labels.slice(0, MAX_ALLOWED_VALUES_IN_ERROR),
        };
        if (labels.length > MAX_ALLOWED_VALUES_IN_ERROR) error.allowed_values_truncated = true;
        return { value: field.value, error };
      }
      canonical.push(matched);
    }
  }

  // regexp 는 실행하지 않는다 (ReDoS). 형식을 알려 주고 Redmine 422 에 맡긴다.
  if (def.regexp !== "" && canonical.some((v) => v !== "")) {
    skipped.push({
      id: field.id,
      check: "regexp",
      reason: "format (regexp) is validated by Redmine on submit",
      regexp: cleanExternalText(def.regexp),
    });
  }

  return { value: Array.isArray(value) ? canonical : canonical[0] };
}

/**
 * custom_fields 입력을 해석·검증한다. 이름 해석 실패(없음·모호·중복)는 예외, 값 검증 실패는 errors 로 돌려준다.
 * 프로젝트 필드 조회와 관리자 정의 조회는 서로 독립이므로 병렬로 수행한다.
 */
export async function resolveIssueCustomFields(
  client: RedmineClient,
  projectId: string | number,
  input: CustomFieldsInput,
  opts: {
    trackerId?: number;
    /** 일감 상세(issue.custom_fields)에 노출된 필드 ID. 있으면 여기에 없는 필드는 오류(조용한 무시 방지). */
    applicableFieldIds?: number[];
  } = {}
): Promise<CustomFieldResolution> {
  const [projectFields, defsResult] = await Promise.all([
    fetchProjectFields(client, projectId),
    fetchDefinitions(client),
  ]);

  const fields: ResolvedCustomField[] = [];
  const keyById = new Map<number, string>();
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.trim();
    const pf = resolveKey(key, projectFields);
    const prev = keyById.get(pf.id);
    if (prev !== undefined) {
      throw new Error(
        `Duplicate custom field: keys ${JSON.stringify(prev)} and ${JSON.stringify(key)} both refer to id ${pf.id}.`
      );
    }
    keyById.set(pf.id, key);
    const value: CustomFieldValue =
      typeof rawValue === "boolean"
        ? rawValue ? "1" : "0"
        : Array.isArray(rawValue)
          ? rawValue.map((v) => String(v))
          : String(rawValue);
    fields.push({ id: pf.id, name: pf.name, value });
  }

  const errors: CustomFieldValueError[] = [];
  const applicable = opts.applicableFieldIds;
  const candidates = applicable === undefined ? fields : [];
  if (applicable !== undefined) {
    for (const field of fields) {
      if (applicable.includes(field.id)) candidates.push(field);
      else {
        errors.push({
          id: field.id,
          name: field.name,
          value: field.value,
          problem: `Custom field id ${field.id} is not available on this issue (tracker, visibility or permissions); Redmine would silently ignore the value.`,
        });
      }
    }
  }

  const finish = (validation: CustomFieldValidationInfo): CustomFieldResolution => ({
    fields: fields.map((f) => ({
      ...f,
      value: Array.isArray(f.value) ? f.value.map(cleanExternalText) : cleanExternalText(f.value),
    })),
    payload: fields.map(({ id, value }) => ({ id, value })),
    validation,
    errors,
  });

  if (!("defs" in defsResult)) {
    return finish({ performed: false, reason: defsResult.skippedReason });
  }

  const skipped: SkippedCheck[] = [];
  for (const field of candidates) {
    const def = defsResult.defs.get(field.id);
    if (!def) {
      skipped.push({ id: field.id, check: "definition", reason: "field definition not found in /custom_fields.json" });
      continue;
    }
    const r = validateField(field, def, opts.trackerId, skipped);
    if (r.error) errors.push(r.error);
    else field.value = r.value;
  }

  const validation: CustomFieldValidationInfo = { performed: true };
  if (skipped.length > 0) validation.skipped_checks = skipped;
  return finish(validation);
}

/**
 * Redmine 422 응답의 errors 배열을 정제된 메시지로 만든다. 예외 경로는 processToolResult 를 거치지 않으므로
 * 제어·보이지 않는 문자를 제거하고 길이를 제한하며, 주입 패턴이 보이면 경고를 덧붙인다. 422 가 아니면 undefined.
 */
export function formatRedmineValidationError(error: any): string | undefined {
  if (!error?.isAxiosError || error.response?.status !== 422) return undefined;
  const errors = error.response?.data?.errors;
  if (!Array.isArray(errors)) return undefined;
  const messages = errors.filter((e: unknown) => typeof e === "string").map((e: string) => cleanExternalText(e));
  let text = messages.join(", ");
  if (text.length > MAX_REDMINE_MESSAGE_LENGTH) text = `${text.slice(0, MAX_REDMINE_MESSAGE_LENGTH)}…`;
  if (detectPromptInjection(messages).hasSuspiciousPattern) {
    text += " [warning: potential prompt injection pattern detected in Redmine response; verify with user]";
  }
  return text;
}
