"use client";

import { useState } from "react";
import { filterVideos, isSearching, type LibraryVideo } from "@/lib/content/search";
import { stageLabel, stages, topicLabel, topics, type StageSlug, type TopicSlug } from "@/lib/content/taxonomy";
import { FilterGroup } from "./FilterGroup";
import { VideoCard } from "./VideoCard";

// Static until the learner's own stage is known (set in onboarding, a later spec).
const YOUR_STAGE: StageSlug = "follow-it";

const stageOptions = stages.map((s) => ({ value: s.slug, label: s.label }));
const topicOptions = topics.map((t) => ({ value: t.slug, label: t.label }));

const plural = (n: number) => `${n} video${n === 1 ? "" : "s"}`;

type Props = { languageSlug: string; videos: LibraryVideo[] };

export function LibraryBrowser({ languageSlug, videos }: Props) {
  const [stage, setStage] = useState<StageSlug>(YOUR_STAGE);
  const [topic, setTopic] = useState<TopicSlug | null>(null);
  const [query, setQuery] = useState("");

  const searching = isSearching(query);
  const results = filterVideos(videos, { stage, topic, query });
  const quoted = `"${query.trim()}"`;
  const where = topic ? `${stageLabel(stage)} about ${topicLabel(topic).toLowerCase()}` : stageLabel(stage);

  let countLine: string;
  if (searching) {
    countLine = results.length
      ? `${plural(results.length)} match ${quoted}.`
      : `Nothing matches ${quoted}. Try a shorter word.`;
  } else if (results.length) {
    countLine = `${plural(results.length)} at ${where}. Your stage is ${stageLabel(YOUR_STAGE)}.`;
  } else {
    countLine = `No videos at ${where} yet. They are on the way.`;
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-space-4">
        <h1 className="m-0 flex-1 basis-[300px] font-display text-display">Library</h1>
        <label className="flex flex-[0_1_360px] flex-col gap-1.5 text-label">
          Search videos
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Café, family, microbus…"
            className="box-border h-12 rounded-sm border border-slate bg-paper px-3.5 text-body font-normal text-ink"
          />
        </label>
      </div>

      <div className="flex flex-col gap-space-3">
        <FilterGroup label="Stage" options={stageOptions} selected={stage} onSelect={setStage} />
        <FilterGroup
          label="Topic"
          options={topicOptions}
          selected={topic}
          onSelect={(value) => setTopic((current) => (current === value ? null : value))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-space-3">
        <p role="status" className="m-0 text-[15px] text-slate">
          {countLine}
        </p>
        {searching && results.length === 0 ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="min-h-11 cursor-pointer rounded-pill border border-slate bg-paper px-4 text-label text-ink"
          >
            Clear search
          </button>
        ) : null}
      </div>

      {results.length ? (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-space-6 p-0">
          {results.map((video, i) => (
            <li key={video.slug} className="flex flex-col">
              <VideoCard languageSlug={languageSlug} video={video} tone={i} />
            </li>
          ))}
        </ul>
      ) : null}

      <p className="m-0 rounded-lg bg-paper/50 p-space-6 text-center text-[15px] text-slate">
        {searching
          ? "That's everything that matches."
          : "That's everything for this stage. New videos arrive every week."}
      </p>
    </>
  );
}
