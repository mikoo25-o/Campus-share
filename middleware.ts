import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the Supabase session fresh and sends signed-out visitors away from pages that need an
 * account. This is a convenience: the real protection is Row Level Security in the database.
 * Public pages (home, sign-up, Find Food, Farmer Market, Leaderboard, Help) are not listed here.
 */
const PROTECTED = [
  "/dashboard", "/donate", "/activity", "/promote", "/credits", "/notifications", "/profile",
  "/onboarding", "/ai", "/admin", "/search", "/farmer-market/new", "/farmer-market/mine",
  "/farmer-market/enquiries", "/farmer-market/profile",
];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next(); // not configured yet: pages show a setup notice

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const needsAccount =
    PROTECTED.some((p) => path === p || path.startsWith(`${p}/`)) || /^\/farmer-market\/[^/]+\/edit$/.test(path);

  if (needsAccount && !data.user) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|images/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
