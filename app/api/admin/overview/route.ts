import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { loadDataset } from "@/lib/data";
import { STATUS_FLOW } from "@/lib/order-flow";
import { listOrders, listRequests } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The success metrics: live numbers from UdyamSaathi next to the Apr-Jun baseline. */
export async function GET(req: Request) {
  if (!isAdmin(req)) return unauthorized();

  const [orders, requests] = await Promise.all([listOrders(), listRequests()]);
  const byStatus = Object.fromEntries([...STATUS_FLOW, "cancelled"].map((s) => [s, 0])) as Record<string, number>;
  for (const o of orders) byStatus[o.status]++;

  const activated = orders.filter((o) => o.status === "active");
  const daysToActive = activated.map((o) => {
    const at = o.events.find((e) => e.status === "active")?.at ?? o.updatedAt;
    return (at - o.createdAt) / 86_400_000;
  });

  const leads = loadDataset("smb_leads");
  const base = leads.filter((r) => r.outcome === "Activated");
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

  return NextResponse.json({
    live: {
      orders: orders.length,
      byStatus,
      monthlyRevenue: orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.monthlyTotal, 0),
      avgDaysToActivate: avg(daysToActive),
      openRequests: requests.filter((r) => r.status !== "resolved").length,
    },
    baseline: {
      leads: leads.length,
      activationRate: base.length / leads.length,
      avgDaysToActivate: avg(base.map((r) => Number(r.days_lead_to_activation))),
      followUpCalls: avg(base.map((r) => Number(r.customer_follow_up_calls))),
      costPerActivation: leads.reduce((s, r) => s + Number(r.acquisition_cost_inr), 0) / base.length,
      churn6m: base.filter((r) => r.churned_within_6_months === "Y").length / base.length,
    },
  });
}
