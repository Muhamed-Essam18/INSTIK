import "server-only";
import { env } from "@/lib/env";
import { defaultLanguage } from "@/lib/languages";
import { parseOwnerEmails } from "@/lib/roles/rules";
import { createCreatorsService } from "./service";
import { prismaCreatorsStore } from "./store";

/** The creator management service wired to the database and the owner list. Built per call so nothing reads the environment at import time. */
export const creatorsService = () =>
  createCreatorsService({ store: prismaCreatorsStore, ownerEmails: parseOwnerEmails(env().OWNER_EMAILS), defaultLanguageCode: defaultLanguage.code });
