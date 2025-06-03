// API service connecting to the real API server
// const API_BASE_URL = 'http://100.65.217.64:8080/api';

// Type definitions
interface AuthResponse {
    success: boolean;
    message?: string;
    data?: unknown;
    token?: string;
}

// interface Student {
//     id: string;
//     name: string;
//     [key: string]: any; // For additional properties
// }

// interface Phase {
//     type: string;
//     content: string;
//     [key: string]: any;
// }

interface ApiResponse<T> {
    success: boolean;
    message?: string;
    data: T;
}

// Student API Types
export interface StudentAssignment {
    id: number;
    subject: string;
    chapter: string;
    topic: string;
    assignmentStatus: string;
    teacherName: string;
    currentPhase: number;
    studentStatus: string;
    phaseEndDate: string;
}

interface AssignmentPhase {
    phaseNumber: number;
    status: string;
    startDate: string;
    endDate: string;
}

export interface StudentAssignmentDetail {
    id: number;
    subject: string;
    chapter: string;
    topic: string;
    description: string;
    teacherName: string;
    phases: AssignmentPhase[];
}

// Tree API Types
export type NodeType = 'argument' | 'evidence' | 'counterargument' | 'question' | 'answer' | 'subject';
export type ApiNodeType = 'CLAIM' | 'COUNTER' | 'SUBJECT';

export type Node = {
    nodeId: string;
    type: NodeType;
    content: string;
    summary?: string;
    citation?: Array<string>;
    index?: number;
    children: Array<Node> | null;
};

export type ArgNode = Node & {
    type: 'argument' | 'counterargument';
    children: Array<EvidenceNode>;
};

export type EvidenceNode = Node & {
    type: 'evidence';
    index: number;
    children: Array<ArgNode | QuestionNode> | null;
};

export type QuestionNode = Node & {
    type: 'question';
    children: Array<AnswerNode> | null;
};

export type AnswerNode = Node & {
    type: 'answer';
    children: null;
};

export type SubjectNode = Node & {
    type: 'subject';
    children: Array<ArgNode> | null;
};

// Enhanced tree structure for rendering
export type RenderableNode = {
    id: string;
    type: 'argument' | 'counterargument' | 'question';
    node: ArgNode | QuestionNode;
    depth: number;
    parentNodeId: string;
    parentEvidenceIndex?: number;
    parentRef?: React.RefObject<any>; // Added for tree component usage
};

export type TreeData = {
    root: SubjectNode;
    renderableNodes: RenderableNode[];
};

// Interface for API response
interface ApiEvidence {
    id: number;
    content: string;
    summary: string;
    source: string | null;
    url: string | null;
}

interface ApiNode {
    id: number;
    content: string;
    summary: string;
    type: ApiNodeType;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    evidences: ApiEvidence[];
    children: ApiNode[];
    triggeredByEvidenceId: number | null;
}

interface ApiTreeResponse {
    status: string;
    data: ApiNode;
}

// Map API node types to component node types
export const mapApiNodeTypeToNodeType = (apiType: ApiNodeType): NodeType => {
    switch (apiType) {
        case 'CLAIM':
            return 'argument';
        case 'COUNTER':
            return 'counterargument';
        case 'SUBJECT':
            return 'subject';
        default:
            return 'argument';
    }
};

// Helper function to get type initial
const getTypeInitial = (nodeType: NodeType): string => {
    switch (nodeType) {
        case 'argument':
            return 'a';
        case 'counterargument':
            return 'c';
        case 'evidence':
            return 'e';
        case 'question':
            return 'q';
        case 'answer':
            return 'ans';
        case 'subject':
            return 's';
        default:
            return 'n';
    }
};

// Convert API node to component node
export const convertApiNodeToNode = (apiNode: ApiNode): Node => {
    const nodeType = mapApiNodeTypeToNodeType(apiNode.type);
    const typeInitial = getTypeInitial(nodeType);

    // Create evidence nodes from API evidences
    const evidenceNodes: EvidenceNode[] = apiNode.evidences.map((evidence, index) => ({
        nodeId: `e-${evidence.id}`,
        type: 'evidence',
        content: evidence.content,
        summary: evidence.summary,
        index: index + 1,
        children: null
    }));

    // Create child nodes (recursively)
    const childNodes = apiNode.children.map(child => convertApiNodeToNode(child));

    // Connect child nodes to appropriate evidence nodes if possible
    if (childNodes.length > 0 && evidenceNodes.length > 0) {
        childNodes.forEach(childNode => {
            const apiChildNode = apiNode.children.find(c => {
                const childTypeInitial = getTypeInitial(mapApiNodeTypeToNodeType(c.type));
                return childNode.nodeId === `${childTypeInitial}-${c.id}`;
            });
            if (apiChildNode && apiChildNode.triggeredByEvidenceId) {
                const evidenceIndex = evidenceNodes.findIndex(
                    e => e.nodeId === `e-${apiChildNode.triggeredByEvidenceId}`
                );
                if (evidenceIndex >= 0 && evidenceNodes[evidenceIndex]) {
                    // Initialize children array if it doesn't exist
                    if (!evidenceNodes[evidenceIndex].children) {
                        evidenceNodes[evidenceIndex].children = [];
                    }
                    // Add this child to the evidence's children
                    evidenceNodes[evidenceIndex].children?.push(childNode as any);
                }
            }
        });
    }

    return {
        nodeId: `${typeInitial}-${apiNode.id}`,
        type: nodeType,
        content: apiNode.content,
        summary: apiNode.summary,
        children: nodeType === 'argument' || nodeType === 'counterargument'
            ? evidenceNodes
            : childNodes.length > 0 ? childNodes : null
    };
};

// Function to recursively collect all renderable nodes (arguments and questions)
const collectRenderableNodes = (node: Node | null, depth: number, parentNodeId: string, parentEvidenceIndex?: number): RenderableNode[] => {
    if (!node) return [];

    const result: RenderableNode[] = [];

    if (node.type === 'argument' || node.type === 'counterargument') {
        const argNode = node as ArgNode;
        const nodeId = `${argNode.type}-${argNode.nodeId}-${depth}`;

        result.push({
            id: nodeId,
            type: argNode.type,
            node: argNode,
            depth,
            parentNodeId: parentNodeId,
            parentEvidenceIndex: parentEvidenceIndex,
        });

        // Process evidence children to find nested arguments/questions
        argNode.children.forEach((evidence) => {
            if (evidence.children) {
                evidence.children.forEach(child => {
                    if (child.type === 'question') {
                        const questionNode = child as QuestionNode;
                        const questionId = `question-${questionNode.nodeId}-${depth + 1}`;

                        result.push({
                            id: questionId,
                            type: 'question',
                            node: questionNode,
                            depth: depth + 1,
                            parentNodeId: evidence.nodeId, // evidence is the parent for questions
                            parentEvidenceIndex: evidence.index ? (evidence.index - 1) : undefined,
                        });
                    } else {
                        const nestedNodes = collectRenderableNodes(
                            child,
                            depth + 1,
                            evidence.nodeId, // evidence is the parent for counterarguments
                            evidence.index ? (evidence.index - 1) : undefined
                        );
                        result.push(...nestedNodes);
                    }
                });
            }
        });
    }

    return result;
};

// Create a subject node from API data
export const createSubjectNodeFromApi = (apiNode: ApiNode): SubjectNode => {
    // The apiNode itself is the subject node now
    const childNodes = apiNode.children.map(child => convertApiNodeToNode(child));

    return {
        nodeId: `s-${apiNode.id}`,
        type: 'subject',
        content: apiNode.content || '주제',
        children: childNodes as ArgNode[]
    };
};

// Create tree data with pre-processed renderable nodes
export const createTreeDataFromApi = (apiNode: ApiNode): TreeData => {
    const subjectNode = createSubjectNodeFromApi(apiNode);

    // Collect all renderable nodes
    const renderableNodes: RenderableNode[] = [];
    if (subjectNode.children) {
        subjectNode.children.forEach(child => {
            renderableNodes.push(...collectRenderableNodes(child, 0, subjectNode.nodeId));
        });
    }

    return {
        root: subjectNode,
        renderableNodes: renderableNodes
    };
};

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

    // Get tree data for assignment and convert to TreeData
    getAssignmentTree: async (assignmentId: string): Promise<TreeData> => {
        try {
            const response = await fetch(`/api/student/assignments/${assignmentId}/nodes/tree`, {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) {
                // Try to parse error response
                const errorData = await response.json();

                // Check if this is the "main node not found" error (400 error)
                if (response.status === 400 &&
                    errorData.status === 'error' &&
                    errorData.data === '메인 노드를 찾을 수 없습니다.') {
                    // Throw specific error for main node not found
                    const error = new Error('Main node not found');
                    error.name = 'MainNodeNotFoundError';
                    throw error;
                }

                throw new Error(`Error fetching tree data: ${response.status}`);
            }

            const apiData: ApiTreeResponse = await response.json();

            if (apiData.status === 'success' && apiData.data && apiData.data.type === 'SUBJECT') {
                return createTreeDataFromApi(apiData.data);
            } else {
                throw new Error('Invalid API response format');
            }
        } catch (error) {
            console.error('Get assignment tree API error:', error);
            throw error;
        }
    },

    // Create response (argument) to question or counterargument
    createResponse: async (assignmentId: string, targetType: 'NODE' | 'EVIDENCE', targetId: number, content: string, evidences: Array<{ content: string, source: string, url: string }>) => {
        try {
            const response = await fetch(`/api/student/assignments/${assignmentId}/responses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    targetType,
                    targetId,
                    content,
                    evidences
                }),
            });

            if (!response.ok) {
                throw new Error(`Error creating response: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Create response API error:', error);
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