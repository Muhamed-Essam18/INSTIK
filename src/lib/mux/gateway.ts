import "server-only";
import { UPLOAD_URL_LIFETIME_SECONDS } from "@/lib/creator/limits";
import type { UploadHost } from "@/lib/creator/upload-service";
import { muxClient } from "./client";
import type { WebhookHost } from "./webhook-service";

/**
 * Mux behind the two small interfaces the services use, or null when the Mux settings are missing. A direct upload is a one-time
 * link for one file, valid for an hour, whose asset has a signed playback policy and carries our video id as its passthrough.
 */
export function muxGateway(): (UploadHost & WebhookHost) | null {
  const mux = muxClient();
  if (!mux) return null;
  return {
    async createDirectUpload({ corsOrigin, videoId }) {
      const upload = await mux.video.uploads.create({
        cors_origin: corsOrigin,
        timeout: UPLOAD_URL_LIFETIME_SECONDS,
        new_asset_settings: { playback_policies: ["signed"], passthrough: videoId, video_quality: "basic" },
      });
      if (!upload.url) throw new Error("Mux returned no upload URL");
      return { id: upload.id, url: upload.url };
    },
    async deleteAsset(assetId) {
      await mux.video.assets.delete(assetId);
    },
  };
}
