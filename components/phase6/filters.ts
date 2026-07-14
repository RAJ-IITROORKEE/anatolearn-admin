import { adminFeedbackListSchema, type AdminFeedbackListInput } from "@/features/feedback/schemas";
import { adminUserListSchema, type AdminUserListInput } from "@/features/users/schemas";

export type Phase6SearchParams = Record<string, string | string[] | undefined>;

const scalar = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

function dateBound(value: string | undefined, endOfDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}${endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"}`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? value : date.toISOString();
}

export type UserFilterValues = {
  q: string; isActive: string; createdFrom: string; createdTo: string; sortBy: string; sortOrder: string;
};

export function parseUserFilters(params: Phase6SearchParams): { input: AdminUserListInput; values: UserFilterValues; hasFilters: boolean } {
  const defaults = { page: 1, pageSize: 20, sortBy: "createdAt", sortOrder: "desc" } as const;
  const raw = {
    page: scalar(params.page), pageSize: 20, q: scalar(params.q) || undefined,
    isActive: scalar(params.isActive) || undefined,
    createdFrom: dateBound(scalar(params.createdFrom), false),
    createdTo: dateBound(scalar(params.createdTo), true),
    sortBy: scalar(params.sortBy) || defaults.sortBy,
    sortOrder: scalar(params.sortOrder) || defaults.sortOrder,
  };
  const parsed = adminUserListSchema.safeParse(raw);
  if (!parsed.success) return {
    input: adminUserListSchema.parse(defaults),
    values: { q: "", isActive: "", createdFrom: "", createdTo: "", sortBy: defaults.sortBy, sortOrder: defaults.sortOrder },
    hasFilters: false,
  };
  const values = {
    q: parsed.data.q ?? "", isActive: scalar(params.isActive) ?? "",
    createdFrom: scalar(params.createdFrom) ?? "", createdTo: scalar(params.createdTo) ?? "",
    sortBy: parsed.data.sortBy, sortOrder: parsed.data.sortOrder,
  };
  return { input: parsed.data, values, hasFilters: Boolean(values.q || values.isActive || values.createdFrom || values.createdTo) };
}

const feedbackTabs = { new: "NEW", reviewed: "REVIEWED", resolved: "RESOLVED" } as const;
export type FeedbackTab = "all" | keyof typeof feedbackTabs;
export type FeedbackFilterValues = {
  tab: FeedbackTab; q: string; type: string; createdFrom: string; createdTo: string; sortBy: string; sortOrder: string;
};

export function parseFeedbackFilters(params: Phase6SearchParams): { input: AdminFeedbackListInput; values: FeedbackFilterValues; hasFilters: boolean } {
  const defaults = { page: 1, pageSize: 20, sortBy: "createdAt", sortOrder: "desc" } as const;
  const tabValue = scalar(params.tab)?.toLowerCase();
  const tab: FeedbackTab = tabValue === "new" || tabValue === "reviewed" || tabValue === "resolved" ? tabValue : "all";
  const raw = {
    page: scalar(params.page), pageSize: 20, q: scalar(params.q) || undefined,
    type: scalar(params.type) || undefined, status: tab === "all" ? undefined : feedbackTabs[tab],
    createdFrom: dateBound(scalar(params.createdFrom), false), createdTo: dateBound(scalar(params.createdTo), true),
    sortBy: scalar(params.sortBy) || defaults.sortBy, sortOrder: scalar(params.sortOrder) || defaults.sortOrder,
  };
  const parsed = adminFeedbackListSchema.safeParse(raw);
  if (!parsed.success) return {
    input: adminFeedbackListSchema.parse(defaults),
    values: { tab: "all", q: "", type: "", createdFrom: "", createdTo: "", sortBy: defaults.sortBy, sortOrder: defaults.sortOrder },
    hasFilters: false,
  };
  const values = {
    tab, q: parsed.data.q ?? "", type: parsed.data.type ?? "",
    createdFrom: scalar(params.createdFrom) ?? "", createdTo: scalar(params.createdTo) ?? "",
    sortBy: parsed.data.sortBy, sortOrder: parsed.data.sortOrder,
  };
  return { input: parsed.data, values, hasFilters: Boolean(values.q || values.type || values.createdFrom || values.createdTo) };
}
