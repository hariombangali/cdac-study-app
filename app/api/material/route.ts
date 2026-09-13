import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BUCKET } from "@/lib/env";
import { exists, normPath } from "@/lib/manifest";

/**
 * GET /api/material?path=<vault-relative path>
 *
 * The storage bucket is private, so this is the only way to reach a file:
 *   - the caller must be logged in
 *   - the path must exist in the generated manifest (no arbitrary bucket reads)
 *   - we hand back a 10-minute signed URL
 *
 * Note: we redirect rather than stream, because Vercel caps a function response
 * body at 4.5 MB and the largest PDF here is 29 MB.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("path");
  if (!raw) {
    return new NextResponse("Missing ?path", { status: 400 });
  }

  const path = normPath(raw);
  if (!exists(path)) {
    return new NextResponse("Unknown file", { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `/${path}`);
    return NextResponse.redirect(login);
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);

  if (error || !data?.signedUrl) {
    return new NextResponse(
      `File not in storage yet: ${path}\n\nRun: npm run upload`,
      { status: 404 },
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
