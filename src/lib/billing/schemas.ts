import { z } from "zod";

// Every Stripe field the billing code reads is parsed here first (constitution X). A parse failure carries
// no input, so a payload can never be echoed into a log line or a response.

const idOrObject = z.union([z.string().min(1), z.object({ id: z.string().min(1) })]).transform((v) => (typeof v === "string" ? v : v.id));

/** The envelope of a verified event: its id and type, and the id and kind of the object it carries. */
export const eventEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({ object: z.object({ id: z.string().min(1).optional(), object: z.string().optional() }).loose() }),
});

/** A Stripe subscription, reduced to what the sync reads. The period end lives on the subscription item. */
export const subscriptionSchema = z.object({
  id: z.string().min(1),
  customer: idOrObject,
  status: z.string().min(1),
  created: z.number().int().positive(),
  cancel_at_period_end: z.boolean(),
  metadata: z.record(z.string(), z.string()).default({}),
  items: z.object({
    data: z
      .array(
        z.object({
          current_period_end: z.number().int().positive(),
          price: z.object({
            id: z.string().min(1),
            lookup_key: z.string().nullable().optional(),
            recurring: z.object({ interval: z.string() }).nullable().optional(),
          }),
        }),
      )
      .min(1),
  }),
});
export type ParsedSubscription = z.infer<typeof subscriptionSchema>;

/** A Checkout Session, reduced to what the return route and the sync read. */
export const checkoutSessionSchema = z.object({
  id: z.string().min(1),
  client_reference_id: z.string().nullable().optional(),
  customer: idOrObject.nullable().optional(),
  subscription: idOrObject.nullable().optional(),
  status: z.string().nullable().optional(),
  payment_status: z.string().nullable().optional(),
});
export type ParsedCheckoutSession = z.infer<typeof checkoutSessionSchema>;

/** An invoice: only the subscription it belongs to (`parent.subscription_details.subscription`). */
export const invoiceSchema = z.object({
  parent: z.object({ subscription_details: z.object({ subscription: idOrObject.nullable().optional() }).nullable().optional() }).nullable().optional(),
});

/** A subscription list item, reduced to the id and status the checkout guard reads. */
export const subscriptionSummarySchema = z.object({ id: z.string().min(1), status: z.string().min(1) });

export type Parsed<T> = { ok: true; data: T } | { ok: false };

function safe<S extends z.ZodType>(schema: S) {
  return (input: unknown): Parsed<z.output<S>> => {
    const result = schema.safeParse(input);
    return result.success ? { ok: true, data: result.data } : { ok: false };
  };
}

export const parseEventEnvelope = safe(eventEnvelopeSchema);
export const parseSubscription = safe(subscriptionSchema);
export const parseCheckoutSession = safe(checkoutSessionSchema);
export const parseInvoice = safe(invoiceSchema);
export const parseSubscriptionSummary = safe(subscriptionSummarySchema);

/** The `period` query of /billing/start. */
export const periodSchema = z.enum(["monthly", "yearly"]);
/** The `session_id` query of /billing/return. */
export const sessionIdSchema = z.string().regex(/^cs_[A-Za-z0-9_]+$/).max(200);
