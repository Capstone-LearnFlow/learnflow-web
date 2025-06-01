"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { exampleTree, NodeType, Node } from '../../tree';
import Chat from '../../chat';
import NodeEditor from './nodeEditor';

// Define types for JSON edit panel
interface EditableFormData {
    assertion: string;
    evidences: string[];
}

type ChatMode = 'ask' | 'create';

const NodeEditorContainer = ({ params }: { params: Promise<{ assigmentId: string, parentNodeId: string, nodeId: string }> }) => {
    const router = useRouter();
    // Chat related state
    const [mode, setMode] = useState<ChatMode>('ask');
    const [isEditPanelOpen, setIsEditPanelOpen] = useState<boolean>(false);
    const [editData, setEditData] = useState<EditableFormData | null>(null);
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [hasChanges, setHasChanges] = useState<boolean>(false);
    const [originalNode, setOriginalNode] = useState<Node | null>(null);
    // Store route params for chat component
    const [assignmentId, setAssignmentId] = useState<string>('');
    const [parentNodeId, setParentNodeId] = useState<string>('');

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

    // Resolve params on component mount
    useEffect(() => {
        params.then(resolvedParams => {
            console.log('Assignment ID:', resolvedParams.assigmentId);
            console.log('Parent Node ID:', resolvedParams.parentNodeId);
            console.log('Node ID:', resolvedParams.nodeId); // 새 노드 추가인 경우 'new'
            
            // Store route params for chat component
            setAssignmentId(resolvedParams.assigmentId);
            setParentNodeId(resolvedParams.parentNodeId);

            // Get parent node from exampleTree
            const parentNodeFromTree = findNodeById(exampleTree, resolvedParams.parentNodeId);

            if (!parentNodeFromTree) {
                console.error('Parent node not found');
                router.back();
                return;
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
                // Get existing node from exampleTree
                const nodeFromTree = findNodeById(exampleTree, resolvedParams.nodeId);

                if (!nodeFromTree) {
                    console.error('Node not found');
                    router.back();
                    return;
                }

                // If it's a question node without an answer, add an empty answer node
                if (nodeFromTree.type === 'question' && (!nodeFromTree.children || nodeFromTree.children.length === 0)) {
                    console.log('Question node has no answer, adding empty answer node');
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
        });
    }, [params, router]);

    // Handler for chat close button
    const handleChatClose = useCallback(() => {
        params.then(resolvedParams => {
            router.push(`/research/${resolvedParams.assigmentId}`);
        });
    }, [params, router]);

    return (
        <div className='node_editor__page'>
            <div className='navigation'>
                <div className='navigation__content navigation__content--large'>
                    <div className='navigation__menu_container'>
                        <div className='navigation__menu navigation__menu--logo navigation__menu--inactive'>LearnFlow</div>
                        <div className='navigation__menu navigation__menu--inactive'>사회(김민지 선생님)</div>
                        <div className='navigation__menu'>토의 준비하기</div>
                    </div>
                    <div className='navigation__menu'>최민준</div>
                </div>
            </div>

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
                />
                <div className='node_editor__chat'>
                    <div className='btn chat__close_btn' onClick={handleChatClose}></div>
                    {/* Only render Chat component when we have valid parameters to prevent empty values */}
                    {assignmentId && parentNodeId && node.nodeId && (
                        <Chat
                            status='open'
                            isClosable={false}
                            nodeId={node.nodeId === 'new' ? '0' : node.nodeId} {/* Use '0' for new nodes */}
                            mode={mode}
                            setMode={setMode}
                            setIsEditPanelOpen={setIsEditPanelOpen}
                            setEditData={setEditData}
                            setEditingMessageIndex={setEditingMessageIndex}
                            isEditPanelOpen={isEditPanelOpen}
                            hideButtons={true}
                            assignmentId={assignmentId}
                            parentNodeId={parentNodeId}
                        />
                    )}
                </div>
            </div>
        </div >
    );
}

export default NodeEditorContainer;
