import "server-only";

import { prisma } from "@/lib/db/prisma";

export async function getAdminAttemptLabels({ organSystemIds, topicIds }: { organSystemIds: readonly string[]; topicIds: readonly string[] }) {
  const uniqueSystemIds = [...new Set(organSystemIds)];
  const uniqueTopicIds = [...new Set(topicIds)];
  const [systems, topics] = await Promise.all([
    uniqueSystemIds.length ? prisma.organSystem.findMany({ where: { id: { in: uniqueSystemIds }, trashedAt: null }, select: { id: true, name: true } }) : [],
    uniqueTopicIds.length ? prisma.topic.findMany({ where: { id: { in: uniqueTopicIds }, trashedAt: null, organSystem: { trashedAt: null } }, select: { id: true, title: true } }) : [],
  ]);
  return {
    systemLabels: new Map(systems.map((system) => [system.id, system.name])),
    topicLabels: new Map(topics.map((topic) => [topic.id, topic.title])),
  };
}
