import OrderDetail from "@/components/admin/OrderDetail";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetail id={decodeURIComponent(id)} />;
}
