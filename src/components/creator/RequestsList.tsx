import type { RequestView } from "@/lib/earnings/dashboard-data";
import { stages, topics, type StageSlug, type TopicSlug } from "@/lib/content/taxonomy";

const stageName = (slug: string) => stages.find((s) => s.slug === (slug as StageSlug))?.label ?? slug;
const topicName = (slug: string) => topics.find((t) => t.slug === (slug as TopicSlug))?.label ?? slug;

/** What the owners would like creators to make next. The list ends: the newest open requests only. */
export function RequestsList({ requests }: { requests: readonly RequestView[] }) {
  return (
    <section aria-labelledby="requests-heading" className="flex flex-col gap-space-3">
      <h2 id="requests-heading" className="m-0 font-display text-heading text-ink">
        What learners need next
      </h2>
      <div className="flex flex-col gap-space-4 rounded-lg bg-paper p-space-6 shadow-sm">
        <span className="text-label text-teal-text">Requests from Instik</span>
        {requests.length === 0 ? (
          <p className="m-0 text-body text-slate">No requests right now.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-space-3 p-0">
            {requests.map((r) => (
              <li key={r.id} className="rounded-md bg-cream px-space-4 py-space-3">
                <strong>
                  {stageName(r.stage)} · {topicName(r.topic)}
                </strong>
                <br />
                <span className="text-label font-normal text-slate">{r.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
