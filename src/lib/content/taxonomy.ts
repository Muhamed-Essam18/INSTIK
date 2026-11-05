export const stages = [
  { slug: "hear-it", label: "Hear it" },
  { slug: "follow-it", label: "Follow it" },
  { slug: "understand-it", label: "Understand it" },
  { slug: "join-in", label: "Join in" },
] as const;

export const topics = [
  { slug: "daily-life", label: "Daily life" },
  { slug: "food", label: "Food" },
  { slug: "family", label: "Family" },
  { slug: "getting-around", label: "Getting around" },
  { slug: "culture", label: "Culture" },
] as const;

export type StageSlug = (typeof stages)[number]["slug"];
export type TopicSlug = (typeof topics)[number]["slug"];

export const stageSlugs = stages.map((s) => s.slug) as [StageSlug, ...StageSlug[]];
export const topicSlugs = topics.map((t) => t.slug) as [TopicSlug, ...TopicSlug[]];

export const stageLabel = (slug: StageSlug): string => stages.find((s) => s.slug === slug)!.label;
export const topicLabel = (slug: TopicSlug): string => topics.find((t) => t.slug === slug)!.label;
export const stageOrder = (slug: StageSlug): number => stageSlugs.indexOf(slug);
