"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { NodeType, Node, TreeData } from '../../tree';
import { studentAPI } from '../../../../../services/api';
import Chat from '../../chat';
import NodeEditor from './nodeEditor';
import ResearchNavigation from '../../../components/ResearchNavigation';

// Define types for JSON edit panel
interface EditableFormData {
    assertion: string;
    evidences: string[];
}

// Define types for AI editor functions
interface EditingContent {
    nodeType: NodeType;
    nodeId: string;
    mainContent: string;
    evidences: Array<{ id: string; content: string; index: number }>;
}

interface EditorUpdates {
    mainContent?: string;
    evidences?: Array<{ id: string; content: string; index?: number }>;
}

type ChatMode = 'ask' | 'create';

const NodeEditorContainer = ({ params }: { params: Promise<{ assignmentId: string, parentNodeId: string, nodeId: string }> }) => {
    const router = useRouter();
    // Chat related state
    const [mode, setMode] = useState<ChatMode>('ask');
    const [isEditPanelOpen, setIsEditPanelOpen] = useState<boolean>(false);
    const [editData, setEditData] = useState<EditableFormData | null>(null);
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [hasChanges, setHasChanges] = useState<boolean>(false);
    const [originalNode, setOriginalNode] = useState<Node | null>(null);
    // Store route params for chat component
    const [resolvedAssignmentId, setResolvedAssignmentId] = useState<string>('');
    const [resolvedParentNodeId, setResolvedParentNodeId] = useState<string>('');
    // Tree data state
    const [treeData, setTreeData] = useState<TreeData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [parentNode, setParentNode] = useState<Node>({
        nodeId: '',
        type: 'subject',
        content: '',
        children: null,
    });
    const [node, setNode] = useState<Node>({
        nodeId: '',
        type: 'argument',
        content: '',
        children: null,
    });

    // Helper function to find a node by ID in the tree
    const findNodeById = (tree: Node, targetId: string): Node | null => {
        if (tree.nodeId === targetId) {
            return tree;
        }

        if (tree.children) {
            for (const child of tree.children) {
                const found = findNodeById(child, targetId);
                if (found) return found;
            }
        }

        return null;
    };

    // Helper function to determine node type for new nodes based on parent type
    const getNewNodeType = (parentType: NodeType): NodeType => {
        switch (parentType) {
            case 'subject':
                return 'argument';
            case 'evidence':
                return 'argument'; // Evidence can have counter-arguments or questions
            case 'question':
                return 'answer';
            default:
                return 'argument';
        }
    };

    // Fetch tree data and set up nodes
    useEffect(() => {
        const fetchTreeData = async () => {
            try {
                const resolvedParams = await params;
                setResolvedAssignmentId(resolvedParams.assignmentId);
                setResolvedParentNodeId(resolvedParams.parentNodeId);

                setIsLoading(true);

                // Fetch tree data from API
                const fetchedTreeData = await studentAPI.getAssignmentTree(resolvedParams.assignmentId);
                setTreeData(fetchedTreeData);

                // Process nodes after tree data is loaded
                await processNodes(resolvedParams, fetchedTreeData);

            } catch (error) {
                console.error('Failed to fetch tree data:', error);
                // Handle specific error for main node not found
                if (error instanceof Error && error.name === 'MainNodeNotFoundError') {
                    const resolvedParams = await params;
                    router.push(`/research/${resolvedParams.assignmentId}/0/new`);
                    return;
                }
                router.back();
            } finally {
                setIsLoading(false);
            }
        };

        fetchTreeData();
    }, [params, router]);

    // Helper function to process nodes after tree data is loaded
    const processNodes = async (resolvedParams: { assignmentId: string, parentNodeId: string, nodeId: string }, fetchedTreeData: TreeData) => {
        // Handle special case for root node (parentNodeId === '0')
        let parentNodeFromTree: Node;

        if (resolvedParams.parentNodeId === '0') {
            // Use the root subject node as parent
            parentNodeFromTree = fetchedTreeData.root;
        } else {
            // Find parent node in the tree
            const foundParentNode = findNodeById(fetchedTreeData.root, resolvedParams.parentNodeId);
            if (!foundParentNode) {
                console.error('Parent node not found');
                router.back();
                return;
            }
            parentNodeFromTree = foundParentNode;
        }

        setParentNode(parentNodeFromTree);

        if (resolvedParams.nodeId === 'new') {
            // Create new node based on parent type
            const newNodeType = getNewNodeType(parentNodeFromTree.type);

            // Only allow creating new nodes under specific parent types
            if (parentNodeFromTree.type === 'subject' || parentNodeFromTree.type === 'evidence') {
                setNode({
                    nodeId: 'new',
                    type: newNodeType,
                    content: '',
                    children: newNodeType === 'argument' ? [] : null,
                });
                setOriginalNode(null); // No original node for new nodes
                setHasChanges(true); // New nodes always have changes
            } else {
                console.error('Cannot create new nodes under this node type:', parentNodeFromTree.type);
                router.back();
                return;
            }
        } else {
            // Get existing node from tree
            const nodeFromTree = findNodeById(fetchedTreeData.root, resolvedParams.nodeId);

            if (!nodeFromTree) {
                console.error('Node not found');
                router.back();
                return;
            }

            // If it's a question node without an answer, add an empty answer node
            if (nodeFromTree.type === 'question' && (!nodeFromTree.children || nodeFromTree.children.length === 0)) {
                const nodeWithAnswer = {
                    ...nodeFromTree,
                    children: [{
                        nodeId: 'new',
                        type: 'answer' as NodeType,
                        content: '',
                        children: null,
                    }]
                };
                setNode(nodeWithAnswer);
                setOriginalNode(JSON.parse(JSON.stringify(nodeWithAnswer))); // Deep copy for comparison
            } else {
                setNode(nodeFromTree);
                setOriginalNode(JSON.parse(JSON.stringify(nodeFromTree))); // Deep copy for comparison
            }
        }
    };

    // Handler for chat close button
    const handleChatClose = useCallback(() => {
        params.then(resolvedParams => {
            router.push(`/research/${resolvedParams.assignmentId}`);
        });
    }, [params, router]);

    // Function to get current editing content for AI
    const getCurrentEditingContent = useCallback((): EditingContent => {
        const editableData: EditingContent = {
            nodeType: node.type,
            nodeId: node.nodeId,
            mainContent: node.content,
            evidences: []
        };

        // For argument and answer nodes, include evidence if available
        if ((node.type === 'argument' || node.type === 'answer') && node.children) {
            editableData.evidences = node.children
                .filter(child => child.type === 'evidence')
                .map(child => ({
                    id: child.nodeId,
                    content: child.content,
                    index: child.index || 0
                }));
        }

        return editableData;
    }, [node]);

    // Function to update editor content from AI suggestions
    const updateEditorContent = useCallback((updates: EditorUpdates) => {
        setNode(prevNode => {
            let updatedNode = { ...prevNode };

            // Update main content if provided
            if (updates.mainContent !== undefined) {
                updatedNode.content = updates.mainContent;

                // Auto-resize main content textarea
                setTimeout(() => {
                    const mainTextarea = document.querySelector('.node_editor__node__content') as HTMLTextAreaElement;
                    if (mainTextarea && mainTextarea.value === updates.mainContent) {
                        mainTextarea.style.height = 'auto';
                        mainTextarea.style.height = mainTextarea.scrollHeight + 'px';
                    }
                }, 0);
            }

            // Update evidences if provided
            if (updates.evidences && updatedNode.children) {
                updatedNode.children = updatedNode.children.map(child => {
                    if (child.type === 'evidence') {
                        const evidenceUpdate = updates.evidences?.find(ev => ev.id === child.nodeId);
                        if (evidenceUpdate) {
                            return {
                                ...child,
                                content: evidenceUpdate.content,
                                index: evidenceUpdate.index || child.index
                            };
                        }
                    }
                    return child;
                });

                // Auto-resize evidence textareas
                setTimeout(() => {
                    updates.evidences?.forEach(evidenceUpdate => {
                        const textarea = document.querySelector(`textarea[data-node-id="${evidenceUpdate.id}"]`) as HTMLTextAreaElement;
                        if (textarea) {
                            textarea.style.height = 'auto';
                            textarea.style.height = textarea.scrollHeight + 'px';
                        }
                    });
                }, 0);
            }

            return updatedNode;
        });
    }, [setNode]);

    return (
        <div className='node_editor__page'>
            <ResearchNavigation assignmentId={resolvedAssignmentId} />

            <div className='node_editor__container'>
                <NodeEditor
                    parentNode={parentNode}
                    node={node}
                    setNode={setNode}
                    hasChanges={hasChanges}
                    params={params}
                    originalNode={originalNode}
                    setHasChanges={setHasChanges}
                    setOriginalNode={setOriginalNode}
                    treeData={treeData}
                // getCurrentEditingContent={getCurrentEditingContent}
                // updateEditorContent={updateEditorContent}
                />
                <div className='node_editor__chat'>
                    <div className='btn chat__close_btn' onClick={handleChatClose}></div>
                    {/* Always show chat, but only save logs when parameters are available */}
                    <Chat
                        status='open'
                        isClosable={false}
                        nodeId={node.nodeId === 'new' ? '0' : node.nodeId || '0'}
                        mode={mode}
                        setMode={setMode}
                        setIsEditPanelOpen={setIsEditPanelOpen}
                        setEditData={setEditData}
                        setEditingMessageIndex={setEditingMessageIndex}
                        isEditPanelOpen={isEditPanelOpen}
                        hideButtons={true}
                        assignmentId={resolvedAssignmentId}
                        parentNodeId={resolvedParentNodeId}
                        getCurrentEditingContent={getCurrentEditingContent}
                        updateEditorContent={updateEditorContent}
                    />
                </div>
            </div>
        </div >
    );
}

export default NodeEditorContainer;
