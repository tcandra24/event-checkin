import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar userEmail={data.user?.email} />
      <main className="flex-1 overflow-x-hidden bg-(--color-canvas-soft) pb-20 lg:pb-0">
        {children}
      </main>
    </div>
  );
}
