import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = 'http://100.65.217.64:8080/api';

export async function POST(request: NextRequest) {
    try {
        // 클라이언트에서 받은 쿠키를 백엔드로 전달
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();

        const cookieHeader = allCookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');

        // 백엔드 API 호출
        const response = await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Cookie': cookieHeader,
            },
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || '로그아웃에 실패했습니다.' },
                { status: response.status }
            );
        }

        // 쿠키 제거
        const cookieResponse = NextResponse.json({ success: true });

        // 백엔드에서 보낸 Set-Cookie 헤더를 클라이언트에도 설정
        const responseCookies = response.headers.getSetCookie();
        if (responseCookies) {
            responseCookies.forEach(cookie => {
                cookieResponse.headers.set('Set-Cookie', cookie);
            });
        }

        return cookieResponse;
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { success: false, message: '서버 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
