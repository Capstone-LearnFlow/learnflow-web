"use client";
import React, { forwardRef, useRef, useImperativeHandle, useLayoutEffect, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export type NodeType = 'argument' | 'evidence' | 'counterargument' | 'question' | 'answer' | 'subject';
export type ApiNodeType = 'CLAIM' | 'COUNTER';
export const getNodeTypeName: (t: NodeType) => string = (t) => {
    switch (t) {
        case 'argument':
            return '주장';
        case 'evidence':
            return '근거';
        case 'counterargument':
            return '예상 반론';
        case 'question':
            return '예상 질문';
        case 'answer':
            return '답변';
        case 'subject':
            return '주제';
        default:
            return '';
    }
};
export type Node = {
    nodeId: string;
    type: NodeType;
    content: string;
    summary?: string;
    citation?: Array<string>;
    index?: number;
    children: Array<Node> | null;
};
type ArgNode = Node & {
    type: 'argument' | 'counterargument';
    children: Array<EvidenceNode>;
};
type EvidenceNode = Node & {
    type: 'evidence';
    index: number;
    children: Array<ArgNode | QuestionNode> | null; // length = 1
};
type QuestionNode = Node & {
    type: 'question';
    children: Array<AnswerNode> | null; // length = 1
};
type AnswerNode = Node & {
    type: 'answer';
    children: null;
};
type SubjectNode = Node & {
    type: 'subject';
    children: Array<ArgNode> | null; // length = 1
};

type Position = {
    x: number;
    y: number;
};
type NodeRef = {
    element: HTMLDivElement | null;
    getHeight: () => number;
    getEvidencePosition: (index: number) => Position | null;
};

type RenderableNode = {
    id: string;
    type: 'argument' | 'counterargument' | 'question';
    node: ArgNode | QuestionNode;
    depth: number;
    parentRef?: React.RefObject<NodeRef | null>;
    parentNodeId: string;
    parentEvidenceIndex?: number;
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
const mapApiNodeTypeToNodeType = (apiType: ApiNodeType): NodeType => {
    switch (apiType) {
        case 'CLAIM':
            return 'argument';
        case 'COUNTER':
            return 'counterargument';
        default:
            return 'argument';
    }
};

// Convert API node to component node
const convertApiNodeToNode = (apiNode: ApiNode): Node => {
    const nodeType = mapApiNodeTypeToNodeType(apiNode.type);
    
    // Create evidence nodes from API evidences
    const evidenceNodes: EvidenceNode[] = apiNode.evidences.map((evidence, index) => ({
        nodeId: evidence.id.toString(),
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
            const apiChildNode = apiNode.children.find(c => c.id.toString() === childNode.nodeId);
            if (apiChildNode && apiChildNode.triggeredByEvidenceId) {
                const evidenceIndex = evidenceNodes.findIndex(
                    e => e.nodeId === apiChildNode.triggeredByEvidenceId?.toString()
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
        nodeId: apiNode.id.toString(),
        type: nodeType,
        content: apiNode.content,
        summary: apiNode.summary,
        children: nodeType === 'argument' || nodeType === 'counterargument' 
            ? evidenceNodes 
            : childNodes.length > 0 ? childNodes : null
    };
};

// Create a subject node from API data
const createSubjectNodeFromApi = (apiNode: ApiNode): SubjectNode => {
    const rootNode = convertApiNodeToNode(apiNode);
    return {
        nodeId: '0',
        type: 'subject',
        content: apiNode.content,
        children: [rootNode] as ArgNode[]
    };
};

const Tree = ({ assigmentId }: { assigmentId: string }) => {
    const router = useRouter();
    const [treeData, setTreeData] = useState<SubjectNode | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch tree data from API
    useEffect(() => {
        const fetchTreeData = async () => {
            if (!assigmentId) return;
            
            try {
                setIsLoading(true);
                const response = await fetch(`/api/student/assignments/${assigmentId}/nodes/tree`);
                
                if (!response.ok) {
                    throw new Error(`Error fetching tree data: ${response.status}`);
                }
                
                const apiData: ApiTreeResponse = await response.json();
                
                if (apiData.status === 'success' && apiData.data) {
                    const transformedData = createSubjectNodeFromApi(apiData.data);
                    setTreeData(transformedData);
                } else {
                    throw new Error('Invalid API response format');
                }
            } catch (err) {
                console.error('Failed to fetch tree data:', err);
                setError(err instanceof Error ? err.message : 'Unknown error occurred');
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchTreeData();
    }, [assigmentId]);

    const positionorigin: { x: number, y: number } = { x: 8, y: 90 };
    const nodeWidth: number = 462;
    const colGap: number = 32;
    const colWidth: number = nodeWidth + colGap;
    const rowGap: number = 12;

    // Track all renderable nodes with their refs and parent relationships
    const [renderableNodes, setRenderableNodes] = useState<RenderableNode[]>([]);
    const [nodePositions, setNodePositions] = useState<Map<string, Position>>(new Map());
    const nodeRefs = useRef<Map<string, React.RefObject<NodeRef | null>>>(new Map());

    // Function to get or create a ref for a specific node
    const getNodeRef = useCallback((nodeId: string): React.RefObject<NodeRef | null> => {
        if (!nodeRefs.current.has(nodeId)) {
            nodeRefs.current.set(nodeId, React.createRef<NodeRef | null>());
        }
        return nodeRefs.current.get(nodeId)!;
    }, []);

    // Function to recursively collect all renderable nodes (arguments and questions)
    const collectRenderableNodes = useCallback((node: Node | null, depth: number, parentId?: string, parentEvidenceIndex?: number, parentNodeId?: string): RenderableNode[] => {
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
                parentRef: parentId ? getNodeRef(parentId) : undefined,
                parentEvidenceIndex: parentEvidenceIndex,
                parentNodeId: parentNodeId || '0' // 최상위는 subject node (nodeId: '0')
            });

            // Process evidence children to find nested arguments/questions
            argNode.children.forEach((evidence, evidenceIndex) => {
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
                                parentRef: getNodeRef(nodeId),
                                parentEvidenceIndex: evidenceIndex,
                                parentNodeId: evidence.nodeId // evidence 노드가 부모
                            });
                        } else {
                            const nestedNodes = collectRenderableNodes(
                                child,
                                depth + 1,
                                nodeId,
                                evidenceIndex,
                                evidence.nodeId // evidence 노드가 부모
                            );
                            result.push(...nestedNodes);
                        }
                    });
                }
            });
        }

        return result;
    }, [getNodeRef]);

    // Calculate positions for all nodes
    const calculatePositions = useCallback((): void => {
        if (renderableNodes.length === 0) return;

        const newPositions = new Map<string, Position>();
        const depthYOffsets = new Map<number, number>();

        // Initialize depth starting positions
        for (let depth = 0; depth <= Math.max(...renderableNodes.map(n => n.depth)); depth++) {
            depthYOffsets.set(depth, positionorigin.y);
        }

        // Process nodes in order (breadth-first by depth)
        const nodesByDepth = new Map<number, RenderableNode[]>();
        renderableNodes.forEach(node => {
            if (!nodesByDepth.has(node.depth)) {
                nodesByDepth.set(node.depth, []);
            }
            nodesByDepth.get(node.depth)!.push(node);
        });

        // Process each depth level
        Array.from(nodesByDepth.keys()).sort((a, b) => a - b).forEach(depth => {
            const nodesAtDepth = nodesByDepth.get(depth)!;

            nodesAtDepth.forEach(nodeData => {
                const x = positionorigin.x + (colWidth * nodeData.depth);
                let y;

                // If this node has a parent, start at parent's y position
                if (nodeData.parentRef && nodeData.parentRef.current?.element && typeof nodeData.parentEvidenceIndex === 'number') {
                    // Get the position of the specific evidence node
                    const evidencePosition = nodeData.parentRef.current.getEvidencePosition(nodeData.parentEvidenceIndex);
                    if (evidencePosition) {
                        // Start at evidence node's y position
                        y = evidencePosition.y;

                        // Only adjust if this would overlap with siblings at the same depth
                        const currentDepthY = depthYOffsets.get(nodeData.depth)!;
                        y = Math.max(y, currentDepthY);
                    } else {
                        y = depthYOffsets.get(nodeData.depth)!;
                    }
                    console.log(`Node ${nodeData.id} at depth ${nodeData.depth} has parent evidence index ${nodeData.parentEvidenceIndex}(${evidencePosition ? evidencePosition.y : 'null'}), starting y: ${y}`);
                } else {
                    // Root level nodes
                    y = depthYOffsets.get(nodeData.depth)!;
                }

                newPositions.set(nodeData.id, { x, y });

                // Update the y offset for this depth to ensure siblings don't overlap
                const nodeRef = getNodeRef(nodeData.id);
                const nodeHeight = nodeRef.current?.getHeight() || 200; // Fallback height
                depthYOffsets.set(nodeData.depth, y + nodeHeight + rowGap);
            });
        });
        console.log('Calculated positions:', newPositions);

        setNodePositions(newPositions);
    }, [renderableNodes, positionorigin.x, positionorigin.y, colWidth, rowGap, getNodeRef]);

    // Calculate renderable nodes when component mounts or tree changes
    useLayoutEffect(() => {
        if (treeData?.children) {
            const nodes: RenderableNode[] = [];
            treeData.children.forEach(child => {
                nodes.push(...collectRenderableNodes(child, 0));
            });
            console.log('Collected renderable nodes:', nodes);
            setRenderableNodes(nodes);
        }
    }, [collectRenderableNodes, treeData]);

    // Calculate positions after nodes are collected and rendered
    useLayoutEffect(() => {
        if (renderableNodes.length > 0) {
            const timeoutId = setTimeout(calculatePositions, 1);
            return () => clearTimeout(timeoutId);
        }
    }, [renderableNodes, calculatePositions]);

    // Recalculate positions when node refs are updated
    const nodeHeights = renderableNodes.map(n => getNodeRef(n.id).current?.getHeight()).join(',');
    useLayoutEffect(() => {
        calculatePositions();
    }, [nodeHeights, calculatePositions]);

    if (isLoading) {
        return <div className="tree__loading">트리 데이터를 불러오는 중...</div>;
    }

    if (error) {
        return <div className="tree__error">트리 데이터를 불러오는데 실패했습니다: {error}</div>;
    }

    if (!treeData) {
        return <div className="tree__empty">트리 데이터가 없습니다.</div>;
    }

    return (
        <div className='tree'>
            <SubjectNode content={treeData.content} />

            {renderableNodes.map((nodeData) => {
                const position = nodePositions.get(nodeData.id) || { x: positionorigin.x + (colWidth * nodeData.depth), y: positionorigin.y };

                // Calculate parent evidence position if parent exists
                let parentEvidencePosition: Position | undefined = undefined;
                if (nodeData.parentRef && nodeData.parentRef.current && typeof nodeData.parentEvidenceIndex === 'number') {
                    parentEvidencePosition = nodeData.parentRef.current.getEvidencePosition(nodeData.parentEvidenceIndex) || undefined;
                }

                if (nodeData.type === 'question') {
                    return (
                        <QuestionNode
                            key={nodeData.id}
                            ref={getNodeRef(nodeData.id)}
                            qNode={nodeData.node as QuestionNode}
                            position={position}
                            parentposition={parentEvidencePosition}
                            assigmentId={assigmentId}
                            parentNodeId={nodeData.parentNodeId}
                        />
                    );
                } else {
                    return (
                        <ArgumentNode
                            key={nodeData.id}
                            ref={getNodeRef(nodeData.id)}
                            argNode={nodeData.node as ArgNode}
                            position={position}
                            parentposition={parentEvidencePosition}
                            assigmentId={assigmentId}
                            parentNodeId={nodeData.parentNodeId}
                        />
                    );
                }
            })}
        </div>
    );
};

const SubjectNode = forwardRef<HTMLDivElement, { content: string }>(({ content }, ref) => {
    return (
        <div ref={ref} className='tree__node tree__node--subject'>
            <div className='tree__node__content_container'>
                <div className='tree__node__title'>주제</div>
                <div className='tree__node__content'>{content}</div>
            </div>
        </div>
    );
});
SubjectNode.displayName = 'SubjectNode';

interface ArgNodeProps {
    argNode: ArgNode,
    position: Position,
    parentposition?: Position,
    assigmentId: string,
    parentNodeId: string
};
const ArgumentNode = forwardRef<NodeRef | null, ArgNodeProps>(({ argNode, position, parentposition, assigmentId, parentNodeId }, ref) => {
    const elementRef = useRef<HTMLDivElement>(null);
    const childRefs = useRef<React.RefObject<HTMLDivElement | null>[]>([]);
    const router = useRouter();

    if (argNode.children) {
        childRefs.current = argNode.children.map(() => React.createRef<HTMLDivElement>());
    }

    const handleNodeBtnClick = () => {
        // Navigate to the node page: /research/[assigmentId]/[parentNodeId]/[nodeId]
        // For ArgumentNode, we use the actual parent node ID and the current argument node as nodeId
        router.push(`/research/${assigmentId}/${parentNodeId}/${argNode.nodeId}`);
    };

    useImperativeHandle(ref, () => ({
        element: elementRef.current,
        getHeight: () => {
            if (elementRef.current) {
                return elementRef.current.offsetHeight;
            }
            return 0;
        },
        getEvidencePosition: (index: number) => {
            if (elementRef.current && childRefs.current[index]?.current) {
                const evidenceRect = childRefs.current[index].current!.getBoundingClientRect();

                // Get the tree container to calculate relative positions
                const treeContainer = elementRef.current.closest('.tree');
                if (treeContainer) {
                    const treeRect = treeContainer.getBoundingClientRect();
                    return {
                        x: evidenceRect.left - treeRect.left,
                        y: evidenceRect.top - treeRect.top
                    };
                }
            }
            return null;
        }
    }));

    return (
        <div ref={elementRef} className={`tree__node tree__node--${argNode.type}`} style={{ left: position.x, top: position.y }}>
            {parentposition && <div className='tree__node__link' style={{ height: `${Math.abs(parentposition.y - position.y)}px` }}></div>}
            <div className='tree__node__content_container'>
                <div className='tree__node__title'>{getNodeTypeName(argNode.type)}</div>
                <div className='tree__node__content'>{argNode.summary || argNode.content}</div>
            </div>
            {argNode.children && (
                <div className="tree__node__children_container">
                    {argNode.children.map((child, i) => (
                        <div key={child.nodeId}>
                            <EvidenceNode
                                ref={childRefs.current[i]}
                                content={child.summary || child.content}
                                index={child.index || 0}
                            />
                        </div>
                    ))}
                </div>
            )}
            <div className='btn tree__node__btn' onClick={handleNodeBtnClick}></div>
        </div>
    );
});
ArgumentNode.displayName = 'ArgumentNode';

const EvidenceNode = forwardRef<HTMLDivElement, { content: string, index: number }>(({ content, index }, ref) => {
    return (
        <div ref={ref} className='tree__node tree__node--evidence'>
            <div className='tree__node__content_container'>
                <div className='tree__node__title'>{`근거 ${index}`}</div>
                <div className='tree__node__content'>{content}</div>
            </div>
        </div>
    );
});
EvidenceNode.displayName = 'EvidenceNode';

interface QuestionNodeProps {
    qNode: QuestionNode,
    position: Position,
    parentposition?: Position,
    assigmentId: string,
    parentNodeId: string
};
const QuestionNode = forwardRef<NodeRef | null, QuestionNodeProps>(({ qNode, position, parentposition, assigmentId, parentNodeId }, ref) => {
    const elementRef = useRef<HTMLDivElement>(null);
    const childRefs = useRef<React.RefObject<HTMLDivElement | null>[]>([]);
    const router = useRouter();

    if (qNode.children) {
        childRefs.current = qNode.children.map(() => React.createRef<HTMLDivElement>());
    }

    const handleNodeBtnClick = () => {
        // Navigate to the node page: /research/[assigmentId]/[parentNodeId]/[nodeId]
        // For QuestionNode, we use the actual parent node ID and the current question node as nodeId
        router.push(`/research/${assigmentId}/${parentNodeId}/${qNode.nodeId}`);
    };

    useImperativeHandle(ref, () => ({
        element: elementRef.current,
        getHeight: () => {
            if (elementRef.current) {
                return elementRef.current.offsetHeight;
            }
            return 0;
        },
        getEvidencePosition: () => null
    }));

    return (
        <div ref={elementRef} className='tree__node tree__node--question' style={{ left: position.x, top: position.y }}>
            {parentposition && <div className='tree__node__link' style={{ height: `${Math.abs(parentposition.y - position.y)}px` }}></div>}
            <div className='tree__node__content_container'>
                <div className='tree__node__title'>예상 질문</div>
                <div className='tree__node__content'>{qNode.summary || qNode.content}</div>
            </div>
            {(qNode.children && qNode.children.length > 0) && (
                <div className="tree__node__children_container">
                    {qNode.children.map((child, i) => (
                        <AnswerNode key={child.nodeId} ref={childRefs.current[i]} content={child.summary || child.content} />
                    ))}
                </div>
            )}
            <div className='btn tree__node__btn' onClick={handleNodeBtnClick}></div>
        </div>
    );
});
QuestionNode.displayName = 'QuestionNode';

const AnswerNode = forwardRef<HTMLDivElement, { content: string }>(({ content }, ref) => {
    return (
        <div ref={ref} className='tree__node tree__node--answer'>
            <div className='tree__node__content_container'>
                <div className='tree__node__title'>답변</div>
                <div className='tree__node__content'>{content}</div>
            </div>
        </div>
    );
});
AnswerNode.displayName = 'AnswerNode';

export default Tree;
