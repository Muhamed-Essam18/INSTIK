import "server-only";
import { env } from "@/lib/env";
import { defaultLanguage } from "@/lib/languages";
import { invitePath } from "@/lib/routes";
import { parseOwnerEmails } from "@/lib/roles/rules";
import { siteUrl } from "@/lib/site";
import { sendInviteEmail } from "./email";
import { createInviteService } from "./service";
import { inviteStore } from "./store";

/** The invitation service wired to the database, the mail service and the owner list. Built per call so nothing reads the environment at import time. */
export const inviteService = () =>
  createInviteService({
    store: inviteStore,
    mailer: sendInviteEmail,
    ownerEmails: parseOwnerEmails(env().OWNER_EMAILS),
    linkFor: (token) => `${siteUrl()}${invitePath(token)}`,
    defaultLanguageCode: defaultLanguage.code,
  });
