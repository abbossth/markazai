import { signOut } from "@/auth";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui";
import { requireAdmin } from "@/lib/session";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="flex min-h-screen">
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-6 border-r p-4">
        <div>
          <div className="text-lg font-semibold">Markazai</div>
          <div className="text-muted-foreground text-xs">Control Plane</div>
        </div>
        <Nav />
        <div className="mt-auto flex flex-col gap-2 text-sm">
          <div>
            <div className="font-medium">{admin.name}</div>
            <div className="text-muted-foreground text-xs">
              {admin.email} · {admin.role}
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button variant="outline" type="submit" className="w-full">
              Chiqish
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-6 p-8">{children}</main>
    </div>
  );
}
