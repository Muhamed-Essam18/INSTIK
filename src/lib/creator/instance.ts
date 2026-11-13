import "server-only";
import { changeStatus } from "@/lib/content/status-service";
import { muxGateway } from "@/lib/mux/gateway";
import { siteUrl } from "@/lib/site";
import { createHostService } from "./host-service";
import { blobPhotoStore } from "./photo-store";
import { prismaHostStore, prismaUploadStore } from "./store";
import { createUploadService } from "./upload-service";

/** The upload service wired to the database, Mux and the status service. Built per call so nothing reads the environment at import time. */
export const uploadService = () =>
  createUploadService({ store: prismaUploadStore, host: muxGateway(), changeStatus, siteOrigin: () => siteUrl() });

/** The host page service wired to the database and photo storage. Built per call. */
export const hostService = () => createHostService({ store: prismaHostStore, photos: blobPhotoStore() });
