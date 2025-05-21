import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = 'http://100.65.217.64:8080/api';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { number } = body;

        // 백엔드 API 호출
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ number }),
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { success: false, message: data.message || '로그인에 실패했습니다.' },
                { status: response.status }
            );
        }

        // 백엔드에서 보낸 쿠키를 클라이언트에도 설정
        const responseCookies = response.headers.getSetCookie();
        if (responseCookies) {
            responseCookies.forEach(cookie => {
                const cookieResponse = NextResponse.json({ success: true, data: data.data });
                cookieResponse.headers.set('Set-Cookie', cookie);
                return cookieResponse;
            });
        }

        return NextResponse.json({ success: true, data: data.data });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { success: false, message: '서버 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
