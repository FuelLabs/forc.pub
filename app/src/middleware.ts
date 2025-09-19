import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const DOCS_HOST = 'docs.forc.pub';
const STATIC_BYPASS_PREFIXES = [
  '/docs',
  '/_next',
  '/api',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/sway_logo.png',
  '/sway_logo.svg',
  '/apple-touch-icon.png',
  '/.well-known'
];

export function middleware(request: NextRequest) {
  if (request.headers.get('host') !== DOCS_HOST) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  const shouldBypass = STATIC_BYPASS_PREFIXES.some((prefix) => {
    if (pathname === prefix) {
      return true;
    }
    const normalized = prefix.endsWith('/') ? prefix : `${prefix}/`;
    return pathname.startsWith(normalized);
  });

  if (shouldBypass) {
    return NextResponse.next();
  }

  const target = pathname === '/' || pathname === ''
    ? '/docs'
    : `/docs/${pathname.replace(/^\/+/, '')}`;

  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = target;

  return NextResponse.rewrite(nextUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
