import { languageName } from "@/components/onboarding/LanguageStep";
import { getLanguageByCode } from "@/lib/languages";
import type { Profile } from "@/lib/learner/profile-rules";
import { ProfileForm } from "./ProfileForm";

/** One form per language profile. Changing one never touches another. */
export function ProfileList({ profiles }: { profiles: readonly Profile[] }) {
  if (profiles.length === 0) {
    return <p className="m-0 text-body text-slate">You haven&apos;t added a language yet.</p>;
  }
  return (
    <div className="flex flex-col gap-space-6">
      {profiles.map((profile) => {
        const language = getLanguageByCode(profile.languageCode);
        return (
          <ProfileForm
            key={profile.languageCode}
            languageName={language ? languageName(language) : profile.languageCode}
            profile={profile}
          />
        );
      })}
    </div>
  );
}
