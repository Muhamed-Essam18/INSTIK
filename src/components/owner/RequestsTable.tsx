"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { stages, topics, type StageSlug, type TopicSlug } from "@/lib/content/taxonomy";
import { closeRequest, editRequest } from "@/lib/requests/actions";
import { MAX_TEXT, type RequestRecord } from "@/lib/requests/service";

const th = "px-space-4 py-space-3 font-semibold";
const td = "px-space-4 py-space-3 align-top";
const input = "min-h-11 w-full rounded-sm border border-slate bg-paper px-space-3 text-body text-ink focus-visible:outline-ink";
const button = "inline-flex min-h-11 items-center justify-center rounded-md border border-slate bg-paper px-space-4 text-label text-ink disabled:opacity-60";

const stageName = (slug: string) => stages.find((s) => s.slug === (slug as StageSlug))?.label ?? slug;
const topicName = (slug: string) => topics.find((t) => t.slug === (slug as TopicSlug))?.label ?? slug;

/** Every request, newest first, at most 100. Open ones can be edited or closed; closed ones are dimmed, labelled "Closed" and stay for the record. */
export function RequestsTable({ requests }: { requests: readonly RequestRecord[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ id: string; text: string }>();

  async function run(id: string, work: () => Promise<{ ok: boolean; message: string }>) {
    setPending(true);
    setMessage(undefined);
    try {
      const result = await work();
      if (!result.ok) setMessage({ id, text: result.message });
      else setEditing(undefined);
      router.refresh();
    } catch {
      setMessage({ id, text: "That didn't go through. Please try again." });
    }
    setPending(false);
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-lg border border-hairline bg-paper p-space-6">
        <p className="m-0 text-body-lg text-ink">No requests yet. Write one above and every creator will see it.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline bg-paper">
      <table className="w-full min-w-[720px] border-collapse text-left text-body">
        <caption className="sr-only">Requests from Instik</caption>
        <thead>
          <tr className="border-b border-hairline text-label text-slate">
            <th scope="col" className={th}>
              Stage
            </th>
            <th scope="col" className={th}>
              Topic
            </th>
            <th scope="col" className={th}>
              Request
            </th>
            <th scope="col" className={th}>
              Status
            </th>
            <th scope="col" className={th}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => {
            const open = r.status === "OPEN";
            if (editing === r.id) {
              return (
                <tr key={r.id} className="border-b border-hairline last:border-b-0">
                  <td colSpan={5} className={td}>
                    <form
                      aria-label="Edit request"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        void run(r.id, () =>
                          editRequest({ id: r.id, stage: String(data.get("stage") ?? ""), topic: String(data.get("topic") ?? ""), text: String(data.get("text") ?? "") }),
                        );
                      }}
                      className="flex flex-col gap-space-3"
                    >
                      <div className="grid gap-space-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-space-1 text-label text-ink">
                          Stage
                          <select name="stage" defaultValue={r.stage} className={input}>
                            {stages.map((s) => (
                              <option key={s.slug} value={s.slug}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-space-1 text-label text-ink">
                          Topic
                          <select name="topic" defaultValue={r.topic} className={input}>
                            {topics.map((t) => (
                              <option key={t.slug} value={t.slug}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="flex flex-col gap-space-1 text-label text-ink">
                        Request
                        <input name="text" type="text" defaultValue={r.text} maxLength={MAX_TEXT} autoComplete="off" className={input} />
                      </label>
                      <div className="flex flex-wrap gap-space-2">
                        <button type="submit" disabled={pending} className={`${button} bg-coral font-semibold`}>
                          Save request
                        </button>
                        <button type="button" onClick={() => setEditing(undefined)} className="min-h-11 px-space-3 text-label underline">
                          Cancel
                        </button>
                      </div>
                      {message?.id === r.id && (
                        <span role="alert" className="text-caption text-coral-text">
                          {message.text}
                        </span>
                      )}
                    </form>
                  </td>
                </tr>
              );
            }
            return (
              <tr key={r.id} className={`border-b border-hairline last:border-b-0 ${open ? "" : "opacity-60"}`}>
                <td className={td}>{stageName(r.stage)}</td>
                <td className={td}>{topicName(r.topic)}</td>
                <td className={td}>{r.text}</td>
                <td className={td}>
                  <span className={`inline-flex items-center rounded-pill px-space-3 py-1 text-label font-semibold ${open ? "bg-teal text-ink" : "bg-hairline text-ink"}`}>{open ? "Open" : "Closed"}</span>
                </td>
                <td className={td}>
                  {open ? (
                    <span className="flex flex-wrap gap-space-2">
                      <button type="button" onClick={() => setEditing(r.id)} aria-label={`Edit the request: ${r.text}`} className={button}>
                        Edit
                      </button>
                      <button type="button" disabled={pending} onClick={() => void run(r.id, () => closeRequest({ id: r.id }))} aria-label={`Close the request: ${r.text}`} className={button}>
                        Close
                      </button>
                      {message?.id === r.id && (
                        <span role="alert" className="text-caption text-coral-text">
                          {message.text}
                        </span>
                      )}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
