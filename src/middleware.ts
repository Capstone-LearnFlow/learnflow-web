import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
    // 세션 쿠키 또는 인증 토큰 확인
    const sessionCookie = request.cookies.get('session_token')?.value;

    // 보호된 경로 패턴
    const protectedPaths = ['/dashboard', '/research'];

    // 현재 경로가 보호된 경로인지 확인
    const isProtectedPath = protectedPaths.some(path =>
        request.nextUrl.pathname.startsWith(path)
    );

    // 로그인 페이지 경로
    const isLoginPath = request.nextUrl.pathname === '/signin';

    // 인증되지 않은 사용자가 보호된 경로에 접근하려고 할 때
    if (isProtectedPath && !sessionCookie) {
        return NextResponse.redirect(new URL('/signin', request.url));
    }

    // 인증된 사용자가 로그인 페이지에 접근하려고 할 때
    if (isLoginPath && sessionCookie) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    // 미들웨어를 적용할 경로 패턴
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
