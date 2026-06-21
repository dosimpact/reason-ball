import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { guestRegex, isDevelopmentEnvironment } from "./lib/constants";
import {
  getRequestIdFromHeaders,
  REQUEST_ID_HEADER,
  withRequestIdHeader,
} from "./lib/request-id";

function nextWithRequestId(request: NextRequest, requestId: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  return withRequestIdHeader(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    requestId
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = getRequestIdFromHeaders(request.headers);

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith("/ping")) {
    return new Response("pong", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
      status: 200,
    });
  }

  const isPublicAssistantRoute =
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/copilotkit") ||
    pathname.startsWith("/api/investment-assistant") ||
    pathname.startsWith("/api/sec");

  if (isPublicAssistantRoute) {
    return nextWithRequestId(request, requestId);
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  if (!token) {
    const redirectUrl = encodeURIComponent(
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );

    return withRequestIdHeader(
      NextResponse.redirect(
        new URL(`/api/auth/guest?redirectUrl=${redirectUrl}`, request.url)
      ),
      requestId
    );
  }

  const isGuest = guestRegex.test(token?.email ?? "");

  if (token && !isGuest && ["/login", "/register"].includes(pathname)) {
    return withRequestIdHeader(
      NextResponse.redirect(new URL("/", request.url)),
      requestId
    );
  }

  return nextWithRequestId(request, requestId);
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/register",

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
