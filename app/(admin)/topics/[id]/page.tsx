import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { getAdmin } from "@/components/phase3/data";
import { ContentError } from "@/features/content/domain";

export default async function LegacyTopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  let topic;
  try {
    topic = await getAdmin("topic", id);
  } catch (error) {
    if (error instanceof ContentError && error.code === "NOT_FOUND" && error.status === 404) notFound();
    throw error;
  }
  let system;
  try {
    system = await getAdmin("organSystem", topic.organSystemId);
  } catch (error) {
    if (error instanceof ContentError && error.code === "NOT_FOUND" && error.status === 404) notFound();
    throw error;
  }
  redirect(`/organ-systems/${system.slug}/topics/${topic.slug}`);
}
