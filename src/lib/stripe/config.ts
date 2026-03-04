export type PlanId = "starter" | "growth" | "agency";

export interface PlanConfig {
  id: PlanId;
  name: string;
  priceId: string;
  price: number;
  clientLimit: number | null; // null = unlimited
}

export const PLANS: Record<PlanId, PlanConfig> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceId: process.env.STRIPE_PRICE_STARTER || "",
    price: 49,
    clientLimit: 3,
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceId: process.env.STRIPE_PRICE_GROWTH || "",
    price: 99,
    clientLimit: 10,
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceId: process.env.STRIPE_PRICE_AGENCY || "",
    price: 249,
    clientLimit: null,
  },
};

export function getPlanByPriceId(priceId: string): PlanConfig | null {
  for (const plan of Object.values(PLANS)) {
    if (plan.priceId === priceId) return plan;
  }
  return null;
}
