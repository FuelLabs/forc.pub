import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const DOCS_HOST = 'docs.forc.pub';
const BYPASS_PREFIXES = ['/docs', '/_next', '/api', '/favicon.ico', '/robots.txt', '/sitemap.xml'];

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');

  if (!host || host !== DOCS_HOST) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  const shouldBypass = BYPASS_PREFIXES.some((prefix) => {
    if (pathname === prefix) {
      return true;
    }

    const normalized = prefix.endsWith('/') ? prefix : `${prefix}/`;
    return pathname.startsWith(normalized);
  });

  if (shouldBypass) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname === '/' ? '/docs' : `/docs/${pathname.replace(/^\/+/, '')}`;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/:path*'],
};
