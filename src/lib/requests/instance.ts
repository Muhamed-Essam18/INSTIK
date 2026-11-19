import "server-only";
import { createRequestsService } from "./service";
import { prismaRequestsStore } from "./store";

/** The content requests service wired to the database. Built per call so nothing is read at import time. */
export const requestsService = () => createRequestsService({ store: prismaRequestsStore });
