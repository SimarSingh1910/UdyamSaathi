import AdminShell from "@/components/admin/AdminShell";

export const metadata = { title: "Back office | UdyamSaathi" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
