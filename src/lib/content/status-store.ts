import "server-only";
import { db } from "@/lib/db";
import type { StatusStore, StatusTx } from "./status-service";
import type { VideoStatusName } from "./status";

// The Prisma side of the status change. It writes only Video.status and appends VideoStatusEvent rows: there is no
// update or delete of an event anywhere (and the database refuses both).

export const prismaStatusStore: StatusStore = {
  transaction: (work) =>
    db().$transaction((p) => {
      const tx: StatusTx = {
        async getVideo(videoId) {
          const row = await p.video.findUnique({ where: { id: videoId }, select: { id: true, status: true, host: { select: { userId: true } } } });
          return row ? { id: row.id, status: row.status as VideoStatusName, hostUserId: row.host.userId } : null;
        },
        // Conditional on the status the decision was made from, so two changes from the same status cannot both win.
        async setStatus(videoId, from, to) {
          const changed = await p.video.updateMany({ where: { id: videoId, status: from }, data: { status: to } });
          return changed.count === 1;
        },
        async appendEvent(event) {
          await p.videoStatusEvent.create({ data: event });
        },
      };
      return work(tx);
    }),
};
