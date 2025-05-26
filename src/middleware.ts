import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get('user')?.value;
    console.log('Session Cookie:', sessionCookie);

    const protectedPaths: Array<string> = []; // ['/'];

    const isLoginPath = request.nextUrl.pathname === '/signin';

    const isProtectedPath = !isLoginPath && protectedPaths.some(path =>
        request.nextUrl.pathname.startsWith(path)
    );


    if (isProtectedPath && !sessionCookie) {
        return NextResponse.redirect(new URL('/signin', request.url));
    }

    if (isLoginPath && sessionCookie) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
