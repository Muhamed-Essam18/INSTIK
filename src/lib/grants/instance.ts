import "server-only";
import { createGrantsService } from "./service";
import { prismaGrantsStore } from "./store";

/** The manual access service wired to the database. Built per call so nothing is read at import time. */
export const grantsService = () => createGrantsService({ store: prismaGrantsStore });
