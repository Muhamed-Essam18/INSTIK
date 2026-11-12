import { notFound } from "next/navigation";
import { LockedVideo } from "@/components/billing/LockedVideo";
import { ComingSoonNotice } from "@/components/ComingSoonNotice";
import { PlaybackProvider } from "@/components/player/PlaybackProvider";
import { WatchCounter } from "@/components/player/WatchCounter";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { TranscriptPanel } from "@/components/transcript/TranscriptPanel";
import { HostCard } from "@/components/watch/HostCard";
import { UnderstandingCheck } from "@/components/watch/UnderstandingCheck";
import { UpNext } from "@/components/watch/UpNext";
import { markLocked } from "@/lib/billing/access";
import { signPlaybackTokens } from "@/lib/billing/playback";
import { getSubscription, requireVideoAccess } from "@/lib/billing/subscription";
import { getHost, getHosts, getTranscriptView, getVideo } from "@/lib/content";
import { getUpNextVideos } from "@/lib/content/library";
import { stageLabel } from "@/lib/content/taxonomy";
import { getLanguageBySlug } from "@/lib/languages";
import { formatLength } from "@/lib/player/format";
import { watchAccess } from "@/lib/learner/profile-rules";
import { getAnswer, getLayers } from "@/lib/learner/preferences";
import { donePath, libraryPath, watchVideoPath } from "@/lib/routes";
import { requireProfile } from "@/lib/session";

/** Reads the language and video params, so it is rendered inside a Suspense boundary by the page. */
export async function WatchScreen({ params }: { params: Promise<{ language: string; video: string }> }) {
  const { language: slug, video: videoSlug } = await params;
  const language = getLanguageBySlug(slug);
  // Only an Approved video is ever found here; any other status looks exactly like a missing page.
  const video = await getVideo(slug, videoSlug);
  if (!language || !video) notFound();

  // Watching needs an account with a profile for this language; otherwise this redirects to sign up or add the language.
  const { learner, profile } = await requireProfile(language.code, watchVideoPath(slug, videoSlug));
  // A profile for a language that is no longer available is kept; its videos say the language is on its way.
  if (watchAccess({ language, profile }) === "language-unavailable") return <ComingSoonNotice language={language} />;

  const [host, hosts] = await Promise.all([getHost(slug, video.host), getHosts(slug)]);
  if (!host) notFound(); // every video shows its host
  const stage = stageLabel(video.stage);
  const languageName = [language.variety, language.name].filter(Boolean).join(" ");

  // Access is decided here, on the server, BEFORE the playback id, tokens, transcript, glossary or answers are read,
  // so a learner without access never receives any of them. Free videos always pass.
  if (!(await requireVideoAccess(learner.id, video)).ok) {
    return (
      <LockedVideo
        languageSlug={slug}
        title={video.title}
        meta={`${stage} · ${formatLength(video.durationSeconds)} · ${languageName}`}
        host={host}
        firstHost={hosts[0]?.slug === host.slug}
      />
    );
  }

  // The learner's own transcript layers and answer for this video come from their account.
  const [initialLayers, initialAnswer, subscription] = await Promise.all([
    getLayers(learner.id, language.code),
    getAnswer(learner.id, language.code, video.slug),
    getSubscription(learner.id),
  ]);

  // Up next shows locked videos as locked, and autoplay only ever moves on to one the learner can watch.
  const upNext = markLocked(await getUpNextVideos(slug, video.slug), subscription, new Date());
  const transcriptView = await getTranscriptView(slug, video.slug);
  const next = upNext.find((v) => !v.locked);
  const playbackTokens = signPlaybackTokens(video) ?? undefined;

  return (
    <PlaybackProvider
      nextHref={next ? watchVideoPath(slug, next.slug) : undefined}
      nextSlug={next?.slug}
      doneHref={donePath(slug)}
    >
      <WatchCounter languageCode={language.code} videoSlug={video.slug} />
      <div className="flex flex-wrap items-start gap-space-8">
        <section aria-label="Video" className="flex min-w-0 grow-[999] basis-[560px] flex-col gap-space-6">
          <VideoPlayer
            playbackId={video.playbackId}
            videoSlug={video.slug}
            title={video.title}
            stageLabel={stage}
            libraryHref={libraryPath(slug)}
            playbackTokens={playbackTokens}
          />

          <div className="flex flex-wrap items-start gap-space-6">
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-space-2">
              <h1 className="m-0 font-display text-title text-ink">{video.title}</h1>
              <p className="m-0 text-caption text-slate">
                {stage} · {formatLength(video.durationSeconds)} · {languageName}
              </p>
            </div>
            <HostCard languageSlug={slug} host={host} first={hosts[0]?.slug === host.slug} />
          </div>

          <UnderstandingCheck language={language} videoSlug={video.slug} initialAnswer={initialAnswer} />

          <UpNext languageSlug={slug} videos={upNext} />
        </section>

        <TranscriptPanel
          language={language}
          view={transcriptView}
          initialLayers={initialLayers}
        />
      </div>
    </PlaybackProvider>
  );
}
