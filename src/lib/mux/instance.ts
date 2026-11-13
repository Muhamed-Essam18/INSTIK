import "server-only";
import { changeStatus } from "@/lib/content/status-service";
import { muxGateway } from "./gateway";
import { prismaWebhookStore } from "./store";
import { createWebhookService } from "./webhook-service";

/** The webhook service wired to the database, Mux and the status service. Built per call. */
export const webhookService = () => createWebhookService({ store: prismaWebhookStore, host: muxGateway(), changeStatus });
