// Stripe-shaped objects for the billing tests (only the fields the code reads, in Stripe's shape).

const T0 = 1_762_000_000; // 2025-11-01
const DAY = 86_400;

type Over = Record<string, unknown>;

export const subscriptionFixture = (over: Over = {}) => ({
  id: "sub_1",
  object: "subscription",
  customer: "cus_1",
  status: "active",
  created: T0,
  cancel_at_period_end: false,
  metadata: { userId: "user-a" },
  items: {
    data: [
      {
        current_period_end: T0 + 30 * DAY,
        price: { id: "price_m", lookup_key: "instik_full_monthly_eur_900", recurring: { interval: "month" } },
      },
    ],
  },
  ...over,
});

export const yearlySubscriptionFixture = (over: Over = {}) =>
  subscriptionFixture({
    items: {
      data: [
        {
          current_period_end: T0 + 365 * DAY,
          price: { id: "price_y", lookup_key: "instik_full_yearly_eur_8100", recurring: { interval: "year" } },
        },
      ],
    },
    ...over,
  });

export const checkoutSessionFixture = (over: Over = {}) => ({
  id: "cs_test_1",
  client_reference_id: "user-a",
  customer: "cus_1",
  subscription: "sub_1",
  status: "complete",
  payment_status: "paid",
  ...over,
});

export const eventFixture = (type: string, object: Over, id = "evt_1") => ({
  id,
  type,
  data: { object },
});

export const T_START = T0;
export const DAY_SECONDS = DAY;
