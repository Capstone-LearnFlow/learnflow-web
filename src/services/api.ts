// API service connecting to the real API server
const API_BASE_URL = 'http://100.65.217.64:8080/api';

// Type definitions
interface AuthResponse {
    success: boolean;
    message?: string;
    data?: any;
    token?: string;
}

interface Student {
    id: string;
    name: string;
    [key: string]: any; // For additional properties
}

interface Phase {
    type: string;
    content: string;
    [key: string]: any;
}

interface AssignmentData {
    subject: string;
    chapter: string;
    topic: string;
    student_ids: string[];
    phases?: Phase[];
    [key: string]: any;
}

interface Assignment {
    id: string;
    subject: string;
    chapter: string;
    topic: string;
    students: Student[];
    phases: Phase[];
    status: string;
    createdAt: string;
    [key: string]: any;
}

interface ApiResponse<T> {
    success: boolean;
    message?: string;
    data: T;
}

// Student API Types
interface StudentAssignment {
    id: number;
    subject: string;
    chapter: string;
    topic: string;
    assignment_status: string;
    teacher_name: string;
    current_phase: number;
    student_status: string;
    phase_end_date: string;
}

interface AssignmentPhase {
    phase_number: number;
    status: string;
    start_date: string;
    end_date: string;
}

interface StudentAssignmentDetail {
    id: number;
    subject: string;
    chapter: string;
    topic: string;
    description: string;
    teacher_name: string;
    phases: AssignmentPhase[];
}

// Authentication API
export const authAPI = {
    login: async (number: string): Promise<AuthResponse> => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ number }),
                credentials: 'include', // Important for handling cookies
            });

            const data: AuthResponse = await response.json();
            return data;
        } catch (error) {
            console.error('Login API error:', error);
            throw error;
        }
    },

    logout: async (): Promise<AuthResponse> => {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });

            const data: AuthResponse = await response.json();
            return data;
        } catch (error) {
            console.error('Logout API error:', error);
            throw error;
        }
    },
};

// Student API
export const studentAPI = {
    // Get list of assignments for the student
    getAssignments: async (): Promise<StudentAssignment[]> => {
        try {
            const response = await fetch('/api/student/assignments', {
                method: 'GET',
                credentials: 'include',
            });

            const data: ApiResponse<StudentAssignment[]> = await response.json();
            return data.data; // Extract the data field from the response
        } catch (error) {
            console.error('Get student assignments API error:', error);
            throw error;
        }
    },

    // Get details of a specific assignment
    getAssignmentDetail: async (assignmentId: number | string): Promise<StudentAssignmentDetail> => {
        try {
            const response = await fetch(`/api/student/assignments/${assignmentId}`, {
                method: 'GET',
                credentials: 'include',
            });

            const data: ApiResponse<StudentAssignmentDetail> = await response.json();
            return data.data; // Extract the data field from the response
        } catch (error) {
            console.error('Get assignment detail API error:', error);
            throw error;
        }
    },
};

const apiServices = {
    auth: authAPI,
    // teacher: teacherAPI,
    student: studentAPI,
};

export default apiServices;