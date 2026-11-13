"use client";

import { useId, useState } from "react";
import { saveHost } from "@/lib/creator/actions";
import { NAME_MAX, STORY_MAX, TOPICS_MAX, TOPIC_MAX, type HostField } from "@/lib/creator/host-rules";
import { Field, describedBy } from "./Field";
import { PhotoField } from "./PhotoField";

type Props = {
  host: { name: string; nameArabic: string | null; story: string; topics: string[]; photo: string | null };
  photosEnabled: boolean;
  /** The public page, so the creator can see what learners see. */
  publicHref: string;
};

const field = "h-[52px] rounded-sm border border-slate bg-paper px-space-3 text-body font-normal text-ink";

/** My host page (the public host page's own fields): photo, name in Latin and Arabic, a short story and up to six topics. */
export function HostForm({ host, photosEnabled, publicHref }: Props) {
  const ids = { name: useId(), arabic: useId(), story: useId(), topics: useId() };
  const [name, setName] = useState(host.name);
  const [nameArabic, setNameArabic] = useState(host.nameArabic ?? "");
  const [story, setStory] = useState(host.story);
  const [topics, setTopics] = useState(host.topics.join(", "));
  const [errors, setErrors] = useState<Partial<Record<HostField, string>>>({});
  const [message, setMessage] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setMessage(undefined);
    setSaved(false);
    setPending(true);
    try {
      const result = await saveHost({ name, nameArabic, story, topics: topics.split(",") });
      if (result.ok) setSaved(true);
      else {
        setMessage(result.message);
        if (result.fields) setErrors(result.fields as Partial<Record<HostField, string>>);
      }
    } catch {
      setMessage("We couldn't save that just now. Please try again.");
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-[720px] flex-col gap-space-6">
      <PhotoField photo={host.photo} name={name} enabled={photosEnabled} />

      <Field id={ids.name} label="Your name" error={errors.name}>
        <input
          id={ids.name}
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy(ids.name, false, Boolean(errors.name))}
          className={field}
        />
      </Field>

      <Field id={ids.arabic} label="Your name in Arabic" error={errors.nameArabic}>
        <input
          id={ids.arabic}
          value={nameArabic}
          maxLength={NAME_MAX}
          dir="rtl"
          lang="arz"
          onChange={(e) => setNameArabic(e.target.value)}
          aria-invalid={errors.nameArabic ? true : undefined}
          aria-describedby={describedBy(ids.arabic, false, Boolean(errors.nameArabic))}
          className={`${field} font-arabic text-[20px]`}
        />
      </Field>

      <Field id={ids.story} label="Your story" hint={`A few warm words for learners. Up to ${STORY_MAX} characters.`} error={errors.story}>
        <textarea
          id={ids.story}
          value={story}
          maxLength={STORY_MAX}
          rows={5}
          onChange={(e) => setStory(e.target.value)}
          aria-invalid={errors.story ? true : undefined}
          aria-describedby={describedBy(ids.story, true, Boolean(errors.story))}
          className="rounded-sm border border-slate bg-paper px-space-3 py-space-3 text-body font-normal text-ink"
        />
      </Field>

      <Field
        id={ids.topics}
        label="Topics"
        hint={`Separate them with commas, for example Food, Family. Up to ${TOPICS_MAX}, each up to ${TOPIC_MAX} characters.`}
        error={errors.topics}
      >
        <input
          id={ids.topics}
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          aria-invalid={errors.topics ? true : undefined}
          aria-describedby={describedBy(ids.topics, true, Boolean(errors.topics))}
          className={field}
        />
      </Field>

      {message && (
        <p role="alert" className="m-0 text-body text-ink">
          {message}
        </p>
      )}
      {saved && (
        <p role="status" className="m-0 text-body text-ink">
          Saved. <a href={publicHref}>See your page as learners do</a>.
        </p>
      )}
      <button type="submit" disabled={pending} className="min-h-12 self-start rounded-md bg-coral px-space-6 text-body font-semibold text-ink disabled:opacity-60">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
