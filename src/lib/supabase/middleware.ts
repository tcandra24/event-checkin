import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  const isPublicAsset = request.nextUrl.pathname.startsWith("/_next");
  const isPublicRsvp = request.nextUrl.pathname.startsWith("/rsvp");
  // Seluruh endpoint di /api/broadcast/* (process & cron) dipanggil
  // server-ke-server (self-chaining maupun oleh Vercel Cron), tanpa sesi
  // login pengguna. Masing-masing diamankan lewat secret-nya sendiri
  // (BROADCAST_PROCESS_SECRET / CRON_SECRET) di dalam route handler-nya,
  // bukan lewat middleware ini.
  const isBroadcastApi = request.nextUrl.pathname.startsWith("/api/broadcast");

  // Semua halaman selain /login, /rsvp/[code] (publik untuk peserta), dan
  // /api/broadcast/* (server-ke-server) wajib login.
  if (!user && !isAuthRoute && !isPublicAsset && !isPublicRsvp && !isBroadcastApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Kalau sudah login dan mencoba akses /login, lempar ke dashboard.
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/peserta";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
