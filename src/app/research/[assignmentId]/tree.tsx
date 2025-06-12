"use client";
import React, { forwardRef, useRef, useImperativeHandle, useLayoutEffect, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { studentAPI, type NodeType, type Node, type ArgNode, type EvidenceNode, type QuestionNode, type AnswerNode, type SubjectNode, type TreeData, type RenderableNode } from '../../../services/api';

export type { NodeType, Node, ArgNode, EvidenceNode, QuestionNode, AnswerNode, SubjectNode, TreeData, RenderableNode };

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

type Position = {
    x: number;
    y: number;
};
type NodeRef = {
    element: HTMLDivElement | null;
    getHeight: () => number;
    getEvidencePosition: (index: number) => Position | null;
};

const Tree = ({ assignmentId }: { assignmentId: string }) => {
    const router = useRouter();
    const [treeData, setTreeData] = useState<TreeData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Helper function to compare tree data for changes
    const compareTreeData = useCallback((oldData: TreeData | null, newData: TreeData): boolean => {
        if (!oldData) return true; // First load, always update

        // Compare serialized data to detect changes
        try {
            const oldSerialized = JSON.stringify(oldData);
            const newSerialized = JSON.stringify(newData);
            return oldSerialized !== newSerialized;
        } catch {
            // If serialization fails, assume data has changed
            return true;
        }
    }, []);

    // Fetch tree data from API with periodic updates
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        let isComponentMounted = true;

        const fetchTreeData = async (isInitialLoad = false) => {
            if (!assignmentId || !isComponentMounted) return;

            try {
                if (isInitialLoad) {
                    setIsLoading(true);
                }
                const transformedData = await studentAPI.getAssignmentTree(assignmentId);

                if (isComponentMounted) {
                    // Only update if data has actually changed
                    if (compareTreeData(treeData, transformedData)) {
                        setTreeData(transformedData);
                        if (!isInitialLoad) {
                            console.log('Tree data updated:', transformedData);
                        }
                    }
                }
            } catch (err) {
                if (!isComponentMounted) return;

                // Handle fetch tree data error
                // Handle specific "main node not found" error
                if (err instanceof Error && err.name === 'MainNodeNotFoundError') {
                    router.push(`/research/${assignmentId}/s-0/new`);
                    return;
                }

                if (isInitialLoad) {
                    setError(err instanceof Error ? err.message : 'Unknown error occurred');
                }
            } finally {
                if (isInitialLoad && isComponentMounted) {
                    setIsLoading(false);
                }

                // Schedule next fetch after 5-10 seconds (random to avoid synchronized requests)
                if (isComponentMounted) {
                    const delay = Math.random() * 5000 + 5000; // 5-10 seconds
                    timeoutId = setTimeout(() => fetchTreeData(false), delay);
                }
            }
        };

        // Initial fetch
        fetchTreeData(true);

        // Cleanup function
        return () => {
            isComponentMounted = false;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [assignmentId, router, compareTreeData, treeData]);
    useEffect(() => {
        console.log('Tree data changed:', treeData);
    }, [treeData]);

    const positionorigin: { x: number, y: number } = { x: 8, y: 90 };
    const nodeWidth: number = 462;
    const colGap: number = 32;
    const colWidth: number = nodeWidth + colGap;
    const rowGap: number = 12;

    // Track all renderable nodes with their refs and parent relationships
    const [renderableNodes, setRenderableNodes] = useState<RenderableNode[]>([]);
    const [nodePositions, setNodePositions] = useState<Map<string, Position>>(new Map());
    const [nodeParentEvidencePositions, setNodeParentEvidencePositions] = useState<Map<string, Position>>(new Map());
    const nodeParentEvidencePositionsRef = useRef<Map<string, Position>>(new Map());
    const nodeRefs = useRef<Map<string, React.RefObject<NodeRef | null>>>(new Map());

    // Force re-render trigger for position updates
    const [forceUpdateCounter, setForceUpdateCounter] = useState<number>(0);

    // Adaptive update interval management
    const [isPositionStable, setIsPositionStable] = useState<boolean>(false);
    const [lastPositionChange, setLastPositionChange] = useState<number>(Date.now());
    const stableThresholdMs = 3000; // 3 seconds without change = stable
    const lastPositionsRef = useRef<Map<string, Position>>(new Map());

    // Update ref whenever state changes
    useEffect(() => {
        nodeParentEvidencePositionsRef.current = nodeParentEvidencePositions;
    }, [nodeParentEvidencePositions]);

    // Function to get or create a ref for a specific node
    const getNodeRef = useCallback((nodeId: string): React.RefObject<NodeRef | null> => {
        if (!nodeRefs.current.has(nodeId)) {
            nodeRefs.current.set(nodeId, React.createRef<NodeRef | null>());
        }
        return nodeRefs.current.get(nodeId)!;
    }, []);

    // Callback for child components to update their parent evidence positions
    const updateParentEvidencePosition = useCallback((nodeId: string, position: Position) => {
        setNodeParentEvidencePositions(prev => {
            // Only update if the position has actually changed
            const existingPos = prev.get(nodeId);
            if (existingPos && existingPos.x === position.x && existingPos.y === position.y) {
                return prev; // No change, return same map to prevent re-render
            }

            const newMap = new Map(prev);
            newMap.set(nodeId, position);
            return newMap;
        });
    }, []);

    // Force position recalculation for all nodes
    const forcePositionUpdate = useCallback(() => {
        setForceUpdateCounter(prev => prev + 1);
    }, []);

    // Check if positions have stabilized
    const checkPositionStability = useCallback((newPositions: Map<string, Position>) => {
        let hasChanged = false;

        // Compare with last known positions
        if (lastPositionsRef.current.size !== newPositions.size) {
            hasChanged = true;
        } else {
            for (const [nodeId, position] of Array.from(newPositions.entries())) {
                const lastPosition = lastPositionsRef.current.get(nodeId);
                if (!lastPosition ||
                    Math.abs(lastPosition.x - position.x) > 1 ||
                    Math.abs(lastPosition.y - position.y) > 1) {
                    hasChanged = true;
                    break;
                }
            }
        }

        if (hasChanged) {
            setLastPositionChange(Date.now());
            setIsPositionStable(false);
            // Update reference positions
            lastPositionsRef.current = new Map(newPositions);
        }
    }, []);

    // Monitor position stability
    useEffect(() => {
        const checkStability = () => {
            const timeSinceLastChange = Date.now() - lastPositionChange;
            if (timeSinceLastChange > stableThresholdMs && !isPositionStable) {
                setIsPositionStable(true);
                console.log('Positions stabilized, switching to slower update interval');
            }
        };

        const intervalId = setInterval(checkStability, 1000);
        return () => clearInterval(intervalId);
    }, [lastPositionChange, isPositionStable, stableThresholdMs]);

    // Add parent refs to renderable nodes when tree data is loaded
    const enrichRenderableNodes = useCallback((nodes: RenderableNode[]): RenderableNode[] => {
        return nodes.map(node => {
            let parentRef: React.RefObject<NodeRef | null> | undefined = undefined;

            if (node.parentEvidenceIndex !== undefined) {
                // For nodes with evidence parents (counterarguments, questions), 
                // find the argument node that contains the evidence with the given parentNodeId
                const parentArgumentNode = nodes.find(n => {
                    // Check if this argument node has evidence children with matching nodeId
                    if (n.node.type === 'argument' || n.node.type === 'counterargument') {
                        const argNode = n.node as ArgNode;
                        return argNode.children.some(evidence => evidence.nodeId === node.parentNodeId);
                    }
                    return false;
                });

                if (parentArgumentNode) {
                    parentRef = getNodeRef(parentArgumentNode.id);
                }
            }

            return {
                ...node,
                parentRef
            };
        });
    }, [getNodeRef]);

    // Calculate positions for all nodes with proper depth ordering and multiple passes
    const calculatePositions = useCallback((): void => {
        if (renderableNodes.length === 0) return;

        const maxDepth = Math.max(...renderableNodes.map(n => n.depth));
        const newPositions = new Map<string, Position>();

        // Multiple passes to handle deep nesting properly
        for (let pass = 0; pass < 3; pass++) {
            const depthYOffsets = new Map<number, number>();

            // Initialize depth starting positions
            for (let depth = 0; depth <= maxDepth; depth++) {
                depthYOffsets.set(depth, positionorigin.y);
            }

            // Group nodes by depth for sequential processing
            const nodesByDepth = new Map<number, RenderableNode[]>();
            renderableNodes.forEach(node => {
                if (!nodesByDepth.has(node.depth)) {
                    nodesByDepth.set(node.depth, []);
                }
                nodesByDepth.get(node.depth)!.push(node);
            });

            // Process each depth level sequentially
            Array.from(nodesByDepth.keys()).sort((a, b) => a - b).forEach(depth => {
                const nodesAtDepth = nodesByDepth.get(depth)!;

                nodesAtDepth.forEach(nodeData => {
                    const x = positionorigin.x + (colWidth * nodeData.depth);
                    let y;

                    // If this node has a parent, try to position it relative to parent evidence
                    if (nodeData.parentRef && typeof nodeData.parentEvidenceIndex === 'number') {
                        let parentEvidenceY = null;

                        // First check dynamic position
                        const dynamicPosition = nodeParentEvidencePositionsRef.current.get(nodeData.id);
                        if (dynamicPosition) {
                            parentEvidenceY = dynamicPosition.y;
                        } else if (nodeData.parentRef.current?.element) {
                            // Try to get evidence position from parent
                            const evidencePosition = nodeData.parentRef.current.getEvidencePosition(nodeData.parentEvidenceIndex);
                            if (evidencePosition) {
                                parentEvidenceY = evidencePosition.y;
                            }
                        }

                        if (parentEvidenceY !== null) {
                            y = parentEvidenceY;
                            // Ensure no overlap with siblings at same depth
                            const currentDepthY = depthYOffsets.get(nodeData.depth)!;
                            y = Math.max(y, currentDepthY);
                        } else {
                            // Parent not ready, use depth offset
                            y = depthYOffsets.get(nodeData.depth)!;
                        }
                    } else {
                        // Root level nodes
                        y = depthYOffsets.get(nodeData.depth)!;
                    }

                    newPositions.set(nodeData.id, { x, y });

                    // Update depth offset for next sibling
                    const nodeRef = getNodeRef(nodeData.id);
                    const nodeHeight = nodeRef.current?.getHeight() || 200;
                    depthYOffsets.set(nodeData.depth, y + nodeHeight + rowGap);
                });
            });
        }

        setNodePositions(newPositions);

        // Check if positions have stabilized
        checkPositionStability(newPositions);
    }, [renderableNodes, positionorigin.x, positionorigin.y, colWidth, rowGap, getNodeRef, checkPositionStability]);

    // Calculate renderable nodes when tree data is loaded
    useLayoutEffect(() => {
        if (treeData?.renderableNodes) {
            // Check if there are any argument nodes directly connected to the subject (depth 0)
            const hasArgumentNodes = treeData.renderableNodes.some(node =>
                (node.type === 'argument' || node.type === 'counterargument') && node.depth === 0
            );

            // If no argument nodes exist at depth 0, redirect to new argument creation page
            if (!hasArgumentNodes) {
                router.push(`/research/${assignmentId}/s-0/new`);
                return;
            }

            // Add parent refs to the pre-processed renderable nodes
            const enrichedNodes = enrichRenderableNodes(treeData.renderableNodes);
            setRenderableNodes(enrichedNodes);

            // Clear position maps for fresh calculation
            setNodePositions(new Map());
            setNodeParentEvidencePositions(new Map());

            // Reset stability tracking for new data
            setIsPositionStable(false);
            setLastPositionChange(Date.now());
            lastPositionsRef.current.clear();
        }
    }, [treeData, enrichRenderableNodes, router, assignmentId]);

    // Initial position calculation after nodes are set
    useLayoutEffect(() => {
        if (renderableNodes.length > 0) {
            // Small delay to ensure DOM elements are ready
            const timeoutId = setTimeout(() => {
                calculatePositions();
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [renderableNodes, calculatePositions]);

    // Recalculate positions when force update is triggered with adaptive timing
    useLayoutEffect(() => {
        if (forceUpdateCounter > 0 && renderableNodes.length > 0) {
            const delay = isPositionStable ? 100 : 50; // Longer delay when stable
            const timeoutId = setTimeout(() => {
                calculatePositions();
            }, delay);
            return () => clearTimeout(timeoutId);
        }
    }, [forceUpdateCounter, calculatePositions, renderableNodes.length, isPositionStable]);

    // Recalculate when parent evidence positions change with adaptive timing
    useLayoutEffect(() => {
        if (nodeParentEvidencePositions.size > 0) {
            const delay = isPositionStable ? 100 : 10; // Longer delay when stable
            const timeoutId = setTimeout(() => {
                calculatePositions();
                // Trigger another update after position calculation to handle deeper nesting
                if (!isPositionStable) {
                    setTimeout(() => {
                        forcePositionUpdate();
                    }, 10);
                }
            }, delay);
            return () => clearTimeout(timeoutId);
        }
    }, [nodeParentEvidencePositions.size, calculatePositions, forcePositionUpdate, isPositionStable]);

    // Adaptive periodic position updates
    useEffect(() => {
        if (renderableNodes.length > 0) {
            // Use adaptive interval based on position stability
            const interval = isPositionStable ? 10000 : 100;

            const intervalId = setInterval(() => {
                forcePositionUpdate();
            }, interval);

            return () => clearInterval(intervalId);
        }
    }, [renderableNodes.length, forcePositionUpdate, isPositionStable]);

    if (isLoading) {
        return (<></>);
    }

    if (error) {
        router.push(`/`);
        return;
    }

    if (!treeData) {
        router.push(`/`);
        return;
    }

    return (
        <div className='tree'>
            {!isPositionStable && (<div className='tree__cover'></div>)}
            <SubjectNode content={treeData.root.content} />

            {renderableNodes.map((nodeData) => {
                const position = nodePositions.get(nodeData.id) || { x: positionorigin.x + (colWidth * nodeData.depth), y: positionorigin.y };

                // Pass parent information to child components so they can calculate position dynamically
                const parentInfo = (nodeData.parentRef && typeof nodeData.parentEvidenceIndex === 'number') ? {
                    parentRef: nodeData.parentRef,
                    parentEvidenceIndex: nodeData.parentEvidenceIndex
                } : undefined;

                if (nodeData.type === 'question') {
                    return (
                        <QuestionNode
                            key={nodeData.id}
                            ref={getNodeRef(nodeData.id)}
                            qNode={nodeData.node as QuestionNode}
                            position={position}
                            parentInfo={parentInfo}
                            assignmentId={assignmentId}
                            parentNodeId={nodeData.parentNodeId}
                            updateParentEvidencePosition={updateParentEvidencePosition}
                            nodeId={nodeData.id}
                            forceUpdateCounter={forceUpdateCounter}
                        />
                    );
                } else {
                    return (
                        <ArgumentNode
                            key={nodeData.id}
                            ref={getNodeRef(nodeData.id)}
                            argNode={nodeData.node as ArgNode}
                            position={position}
                            parentInfo={parentInfo}
                            assignmentId={assignmentId}
                            parentNodeId={nodeData.parentNodeId}
                            updateParentEvidencePosition={updateParentEvidencePosition}
                            nodeId={nodeData.id}
                            forceUpdateCounter={forceUpdateCounter}
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
    parentInfo?: {
        parentRef: React.RefObject<NodeRef | null>,
        parentEvidenceIndex: number
    },
    assignmentId: string,
    parentNodeId: string,
    updateParentEvidencePosition: (nodeId: string, position: Position) => void,
    nodeId: string,
    forceUpdateCounter: number
};
const ArgumentNode = forwardRef<NodeRef | null, ArgNodeProps>(({
    argNode,
    position,
    parentInfo,
    assignmentId,
    parentNodeId,
    updateParentEvidencePosition,
    nodeId,
    forceUpdateCounter
}, ref) => {
    const elementRef = useRef<HTMLDivElement>(null);
    const childRefs = useRef<React.RefObject<HTMLDivElement | null>[]>([]);
    const router = useRouter();
    const [parentEvidencePosition, setParentEvidencePosition] = useState<Position | undefined>(undefined);
    const updateParentEvidencePositionRef = useRef(updateParentEvidencePosition);

    // Update ref when prop changes
    useEffect(() => {
        updateParentEvidencePositionRef.current = updateParentEvidencePosition;
    }, [updateParentEvidencePosition]);

    if (argNode.children) {
        childRefs.current = argNode.children.map(() => React.createRef<HTMLDivElement>());
    }

    // Calculate parent evidence position dynamically with adaptive timing
    useEffect(() => {
        const updateParentPosition = () => {
            if (parentInfo && parentInfo.parentRef.current) {
                const evidencePos = parentInfo.parentRef.current.getEvidencePosition(parentInfo.parentEvidenceIndex);
                if (evidencePos) {
                    setParentEvidencePosition(evidencePos);
                    updateParentEvidencePositionRef.current(nodeId, evidencePos);
                }
            }
        };

        // Update immediately
        updateParentPosition();

        // Set up adaptive retries - fewer retries when positions are likely stable
        const baseDelays = [50, 200, 500, 1000];
        const adaptiveDelays = forceUpdateCounter < 5 ? baseDelays : [200, 1000]; // Fewer retries after initial settling

        const timeouts = adaptiveDelays.map((delay) =>
            setTimeout(updateParentPosition, delay)
        );

        return () => {
            timeouts.forEach(timeout => clearTimeout(timeout));
        };
    }, [parentInfo, nodeId, forceUpdateCounter]); // ArgumentNode adaptive timing

    const handleNodeBtnClick = () => {
        // Navigate to the node page: /research/[assignmentId]/[parentNodeId]/[nodeId]
        // For ArgumentNode, we use the actual parent node ID and the current argument node as nodeId
        router.push(`/research/${assignmentId}/${parentNodeId}/${argNode.nodeId}`);
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
            {parentEvidencePosition && (
                <div
                    className='tree__node__link'
                    style={{
                        height: `${Math.abs(parentEvidencePosition.y - position.y)}px`
                    }}
                ></div>
            )}
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
    parentInfo?: {
        parentRef: React.RefObject<NodeRef | null>,
        parentEvidenceIndex: number
    },
    assignmentId: string,
    parentNodeId: string,
    updateParentEvidencePosition: (nodeId: string, position: Position) => void,
    nodeId: string,
    forceUpdateCounter: number
};
const QuestionNode = forwardRef<NodeRef | null, QuestionNodeProps>(({
    qNode,
    position,
    parentInfo,
    assignmentId,
    parentNodeId,
    updateParentEvidencePosition,
    nodeId,
    forceUpdateCounter
}, ref) => {
    const elementRef = useRef<HTMLDivElement>(null);
    const childRefs = useRef<React.RefObject<HTMLDivElement | null>[]>([]);
    const router = useRouter();
    const [parentEvidencePosition, setParentEvidencePosition] = useState<Position | undefined>(undefined);
    const updateParentEvidencePositionRef = useRef(updateParentEvidencePosition);

    // Update ref when prop changes
    useEffect(() => {
        updateParentEvidencePositionRef.current = updateParentEvidencePosition;
    }, [updateParentEvidencePosition]);

    if (qNode.children) {
        childRefs.current = qNode.children.map(() => React.createRef<HTMLDivElement>());
    }

    // Calculate parent evidence position dynamically with improved timing
    useEffect(() => {
        const updateParentPosition = () => {
            if (parentInfo && parentInfo.parentRef.current) {
                const evidencePos = parentInfo.parentRef.current.getEvidencePosition(parentInfo.parentEvidenceIndex);
                if (evidencePos) {
                    setParentEvidencePosition(evidencePos);
                    updateParentEvidencePositionRef.current(nodeId, evidencePos);
                }
            }
        };

        // Update immediately
        updateParentPosition();

        // Set up adaptive retries - fewer retries when positions are likely stable
        const baseDelays = [50, 200, 500, 1000];
        const adaptiveDelays = forceUpdateCounter < 5 ? baseDelays : [200, 1000]; // Fewer retries after initial settling

        const timeouts = adaptiveDelays.map((delay) =>
            setTimeout(updateParentPosition, delay)
        );

        return () => {
            timeouts.forEach(timeout => clearTimeout(timeout));
        };
    }, [parentInfo, nodeId, forceUpdateCounter]); // QuestionNode adaptive timing

    const handleNodeBtnClick = () => {
        // Navigate to the node page: /research/[assignmentId]/[parentNodeId]/[nodeId]
        // For QuestionNode, we use the actual parent node ID and the current question node as nodeId
        router.push(`/research/${assignmentId}/${parentNodeId}/${qNode.nodeId}`);
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
            {parentEvidencePosition && (
                <div
                    className='tree__node__link'
                    style={{
                        height: `${Math.abs(parentEvidencePosition.y - position.y)}px`
                    }}
                ></div>
            )}
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
