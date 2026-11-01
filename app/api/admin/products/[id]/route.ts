import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { parseProductInput } from "@/lib/product-input";
import { deleteProduct, listProducts, upsertProduct } from "@/lib/store";

export const runtime = "nodejs";

/** PATCH /api/admin/products/:id: edit a service. Send the full product, or { active } to hide/show. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  const id = (await params).id;
  const all = listProducts(true);
  const current = all.find((p) => p.id === id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });

  const { product, errors } = parseProductInput({ ...current, ...body }, id, new Set(all.map((p) => p.id)));
  if (!product) return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  return NextResponse.json(upsertProduct(product));
}

/** DELETE /api/admin/products/:id. Existing orders keep their copy of the product. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  const ok = deleteProduct((await params).id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
