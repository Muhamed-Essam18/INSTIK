import "server-only";
import { siteUrl } from "@/lib/site";
import { sendDecisionEmail } from "./email";
import { createReviewService } from "./service";
import { prismaReviewStore } from "./store";

/** The review service wired to the database and the mail service. Built per call so nothing reads the environment at import time. */
export const reviewService = () => createReviewService({ store: prismaReviewStore, mailer: sendDecisionEmail, siteOrigin: () => siteUrl() });
