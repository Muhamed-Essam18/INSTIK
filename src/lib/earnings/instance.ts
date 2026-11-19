import "server-only";
import { readCreatorDashboard } from "./dashboard";
import { createManualRevenueSource } from "./revenue-source";
import { createEarningsService } from "./service";
import { prismaEarningsStore } from "./store";

/** The earnings service wired to the database and the manual revenue source (owner-entered figures). Built per call so nothing is read at import time. */
export const earningsService = () =>
  createEarningsService({
    store: prismaEarningsStore,
    revenue: createManualRevenueSource((month) => prismaEarningsStore.getRevenue(month)),
    // The cached per-creator dashboard reader: wired here and nowhere else.
    readDashboard: readCreatorDashboard,
  });
