import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const publicPaths = ["/signin", "/signup", "/api/auth"];
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));

  if (!isLoggedIn && !isPublicPath) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  if (isLoggedIn && (pathname === "/signin" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/lobby", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
