import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = 'http://100.65.217.64:8080/api';

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string, nodeId: string }> }
) {
    try {
        const { id: assignmentId, nodeId } = await context.params;
        const body = await request.json();

        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();
        const cookieHeader = allCookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');

        // Get the authentication token if available
        const authToken = cookieStore.get('authToken')?.value;

        // Prepare headers with authorization
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            'Cookie': cookieHeader,
        };
        // Add Authorization header if token exists
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        // Forward the request to the backend server
        const response = await fetch(`${API_BASE_URL}/student/assignments/${assignmentId}/nodes/${nodeId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body),
            credentials: 'include',
        });

        // If unauthorized, return appropriate error
        if (response.status === 401) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Unauthorized. Please log in again.',
                },
                { status: 401 }
            );
        }

        // Get the response data
        const data = await response.json();

        // Return the response with the same status
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error(`Error updating node for assignment:`, error);
        return NextResponse.json(
            {
                success: false,
                message: 'Failed to update node',
            },
            { status: 500 }
        );
    }
}
