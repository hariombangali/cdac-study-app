import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from "@/lib/env";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Refreshes the Supabase auth cookie on every request so sessions don't lapse.
 *
 * Bails out early when the project isn't configured yet — createServerClient throws
 * on empty URL/key, which would otherwise 500 every request and hide the setup
 * instructions behind an error page.
 */
export async function updateSession(request: NextRequest) {
  if (!isConfigured) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    await supabase.auth.getUser();
  } catch {
    // Supabase unreachable. Let the request through; the page decides what to show
    // and the login form surfaces the real error if they try to sign in.
  }

  return response;
}
