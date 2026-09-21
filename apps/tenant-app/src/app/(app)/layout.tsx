import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Proxy — birinchi to'siq, bu — haqiqiy tekshiruv.
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { name, phone, image, roles } = session.user;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={{ name: name ?? "", phone, image, roles }} />
        <main className="bg-muted/30 flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
