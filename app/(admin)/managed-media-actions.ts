"use server";

import { getMedia, listMedia } from "@/features/media/service";
import { requireAdminPage } from "@/lib/auth/session";

export async function searchManagedMediaAction(input: { page: number; search?: string; selectedId?: string }) {
  await requireAdminPage();
  const page = Number.isInteger(input.page) && input.page > 0 ? input.page : 1;
  const search = input.search?.trim().slice(0, 200) || undefined;
  const result = await listMedia({ page, pageSize: 8, search, archived: false });
  let selected = null;
  if (input.selectedId) {
    try {
      const asset = await getMedia(input.selectedId);
      if (!asset.archivedAt) selected = asset;
    } catch {
      selected = null;
    }
  }
  return { ...result, selected };
}
