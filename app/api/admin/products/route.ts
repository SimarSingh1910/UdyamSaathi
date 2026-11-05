import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { parseProductInput } from "@/lib/product-input";
import { listProducts, nextProductId, upsertProduct } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/products: all products, including hidden ones. */
export async function GET(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  return NextResponse.json({ products: await listProducts(true) });
}

/** POST /api/admin/products: add a new service to the catalogue. */
export async function POST(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });

  const id = await nextProductId();
  const { product, errors } = parseProductInput(body, id, new Set((await listProducts(true)).map((p) => p.id)));
  if (!product) return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  return NextResponse.json(await upsertProduct(product), { status: 201 });
}
