import { adminAttemptListSchema, type AdminAttemptListInput } from "@/features/progress/schemas";

export type AttemptSearchParams = Record<string, string | string[] | undefined>;

export type AttemptFilterValues = {
  q: string;
  assessmentType: string;
  organSystemId: string;
  status: string;
  from: string;
  to: string;
  sortBy: string;
  sortOrder: string;
};

const defaults = { page: 1, pageSize: 20, sortBy: "startedAt", sortOrder: "desc" } as const;
const scalar = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

function dateBound(value: string | undefined, endOfDay: boolean) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? value : date.toISOString();
}

export function parseAttemptFilters(params: AttemptSearchParams): {
  input: AdminAttemptListInput;
  values: AttemptFilterValues;
  hasFilters: boolean;
} {
  const raw = {
    page: scalar(params.page),
    pageSize: 20,
    q: scalar(params.q) || undefined,
    assessmentType: scalar(params.assessmentType) || undefined,
    organSystemId: scalar(params.organSystemId) || undefined,
    status: scalar(params.status) || undefined,
    from: dateBound(scalar(params.from), false),
    to: dateBound(scalar(params.to), true),
    sortBy: scalar(params.sortBy) || defaults.sortBy,
    sortOrder: scalar(params.sortOrder) || defaults.sortOrder,
  };
  const parsed = adminAttemptListSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      input: adminAttemptListSchema.parse(defaults),
      values: { q: "", assessmentType: "", organSystemId: "", status: "", from: "", to: "", sortBy: defaults.sortBy, sortOrder: defaults.sortOrder },
      hasFilters: false,
    };
  }

  const values = {
    q: parsed.data.q ?? "",
    assessmentType: parsed.data.assessmentType ?? "",
    organSystemId: parsed.data.organSystemId ?? "",
    status: parsed.data.status ?? "",
    from: scalar(params.from) ?? "",
    to: scalar(params.to) ?? "",
    sortBy: parsed.data.sortBy,
    sortOrder: parsed.data.sortOrder,
  };
  return {
    input: parsed.data,
    values,
    hasFilters: Boolean(values.q || values.assessmentType || values.organSystemId || values.status || values.from || values.to),
  };
}
