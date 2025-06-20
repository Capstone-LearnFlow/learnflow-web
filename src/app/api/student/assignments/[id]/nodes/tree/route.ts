import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
// import { ApiNodeType } from '../../../../../../../services/api';

const API_BASE_URL = 'http://100.65.217.64:8080/api';

// Interface for API response (keeping these here as they're only used in this route)
// interface ApiEvidence {
//     id: number;
//     content: string;
//     summary: string;
//     source: string | null;
//     url: string | null;
// }

// interface ApiNode {
//     id: number;
//     content: string;
//     summary: string;
//     type: ApiNodeType;
//     createdBy: string;
//     createdAt: string;
//     updatedAt: string;
//     evidences: ApiEvidence[];
//     children: ApiNode[];
//     triggeredByEvidenceId: number | null;
// }

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: assignmentId } = await context.params;

        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();
        const cookieHeader = allCookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');

        // Get the authentication token if available
        const authToken = cookieStore.get('authToken')?.value;

        // Prepare headers with authorization
        const headers: HeadersInit = {
            'Cookie': cookieHeader,
        };
        // Add Authorization header if token exists
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        // Forward the request to the backend server
        const response = await fetch(`${API_BASE_URL}/student/assignments/${assignmentId}/nodes/tree`, {
            headers,
            credentials: 'include',
            cache: 'no-store',
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
        console.error(`Error fetching tree data for assignment:`, error);
        return NextResponse.json(
            {
                success: false,
                message: 'Failed to fetch assignment tree data',
            },
            { status: 500 }
        );
    }
}