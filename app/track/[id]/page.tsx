import Tracker from "@/components/Tracker";

export const metadata = { title: "Track order | UdyamSaathi" };

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Tracker id={decodeURIComponent(id)} />;
}
