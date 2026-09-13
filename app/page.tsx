import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/env";
import { StoreProvider } from "@/lib/store";
import Dashboard from "@/components/Dashboard";
import SetupNotice from "@/components/SetupNotice";

// Always render per-request: the page depends on the auth cookie.
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!isConfigured) return <SetupNotice />;

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Supabase unreachable or keys wrong — send them to the login page rather than
    // showing a 500. The login page surfaces the real error when they try to sign in.
    userId = null;
  }

  if (!userId) redirect("/login");

  return (
    <StoreProvider>
      <Dashboard />
    </StoreProvider>
  );
}
