import { IBM_Plex_Sans } from "next/font/google";
import AdminShell from "@/components/admin/AdminShell";

export const metadata = { title: "Back office | UdyamSaathi" };

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={plex.className}>
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
