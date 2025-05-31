"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { exampleTree, NodeType, Node, getNodeTypeName } from '../../tree';
import Chat from '../../chat';

// Define types for JSON edit panel
interface EditableFormData {
    assertion: string;
    evidences: string[];
}

type ChatMode = 'ask' | 'create';

const NodeEditor = ({ params }: { params: Promise<{ assigmentId: string, parentNodeId: string, nodeId: string }> }) => {
    const router = useRouter();
    // Chat related state
    const [mode, setMode] = useState<ChatMode>('ask');
    const [isEditPanelOpen, setIsEditPanelOpen] = useState<boolean>(false);
    const [editData, setEditData] = useState<EditableFormData | null>(null);
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [hasChanges, setHasChanges] = useState<boolean>(false);
    const [originalNode, setOriginalNode] = useState<Node | null>(null);
    // const [nodeType, setNodeType] = useState<NodeType>('subject'); // subject, argument, counterargument, question
    // const [status, setStatus] = useState<'view' | 'add' | 'edit'>('add');
    // const [editableNodeType, setEditableNodeType] = useState<NodeType>('argument'); // argument(with evidence), answer

    // nodeType에 따라 다르게 렌더링
    // 타입 별 가능한 상태
    // subject: add
    // argument: edit
    // counterargument: view, add
    // question: add

    // add/edit 상태인 경우, chat에 edit 모드 활성화

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

    // Helper function to find parent node of a given nodeId
    const findParentNode = (tree: Node, targetId: string): Node | null => {
        if (tree.children) {
            for (const child of tree.children) {
                if (child.nodeId === targetId) {
                    return tree;
                }
                const found = findParentNode(child, targetId);
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

    // Helper function to check if argument node is valid for registration
    const isArgumentValid = useCallback((currentNode: Node): boolean => {
        if (currentNode.type !== 'argument') {
            return true; // Non-argument nodes don't need this validation
        }

        // Argument must have content
        if (currentNode.content.trim() === '') {
            return false;
        }

        // Argument must have at least one evidence with non-empty content
        if (!currentNode.children || currentNode.children.length === 0) {
            return false;
        }

        const validEvidences = currentNode.children.filter(child =>
            child.type === 'evidence' && child.content.trim() !== ''
        );

        return validEvidences.length > 0;
    }, []);

    // Helper function to check if current node has changes
    const checkForChanges = useCallback((currentNode: Node): boolean => {
        // Check if argument is valid first
        if (!isArgumentValid(currentNode)) {
            return false; // Invalid arguments cannot be registered
        }

        // If it's a new node, always has changes if content is not empty or has children
        if (currentNode.nodeId === 'new') {
            return currentNode.content.trim() !== '' ||
                (currentNode.children && currentNode.children.some(child => child.content.trim() !== '')) || false;
        }

        // If no original node to compare, consider unchanged
        if (!originalNode) {
            return false;
        }

        // Compare current node with original
        if (currentNode.content !== originalNode.content) {
            return true;
        }

        // Compare children if they exist
        if (currentNode.children && originalNode.children) {
            if (currentNode.children.length !== originalNode.children.length) {
                return true;
            }

            for (let i = 0; i < currentNode.children.length; i++) {
                const currentChild = currentNode.children[i];
                const originalChild = originalNode.children[i];

                if (currentChild.nodeId.startsWith('new-') ||
                    currentChild.content !== originalChild.content) {
                    return true;
                }
            }
        } else if (currentNode.children !== originalNode.children) {
            return true;
        }

        return false;
    }, [originalNode, isArgumentValid]);

    // Check for changes whenever node changes
    useEffect(() => {
        const hasNodeChanges = checkForChanges(node);
        setHasChanges(hasNodeChanges);
    }, [node, checkForChanges]);

    // Handler for register button click
    const handleRegisterNode = useCallback(() => {
        if (!hasChanges) {
            console.log('No changes to register');
            return;
        }

        // Additional validation for argument nodes
        if (node.type === 'argument' && !isArgumentValid(node)) {
            console.log('Cannot register argument: must have at least one evidence with content');
            return;
        }

        // Prepare data for server submission
        const nodeData = {
            nodeId: node.nodeId,
            type: node.type,
            content: node.content,
            children: node.children?.map(child => ({
                nodeId: child.nodeId,
                type: child.type,
                content: child.content,
                citation: child.citation,
                index: child.index
            })) || null,
            parentNodeId: parentNode.nodeId,
            timestamp: new Date().toISOString()
        };

        console.log('Registering node:', nodeData);

        // Reset changes state after successful registration
        setHasChanges(false);
        setOriginalNode(JSON.parse(JSON.stringify(node))); // Update original node to current state

        // TODO: Replace with actual server submission
        // await submitNodeData(nodeData);
    }, [hasChanges, node, parentNode.nodeId, isArgumentValid]);

    // Textarea auto-resize
    const autoResize = useCallback((textarea: HTMLTextAreaElement) => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }, []);
    const handleNodeContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setNode(prevNode => ({
            ...prevNode,
            content: newContent
        }));
        autoResize(e.target);
    }, [autoResize]);
    const handleChildContentChange = useCallback((childId: string, newContent: string, e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNode(prevNode => ({
            ...prevNode,
            children: prevNode.children?.map(child =>
                child.nodeId === childId
                    ? { ...child, content: newContent }
                    : child
            ) || null
        }));
        autoResize(e.target);
    }, [autoResize]);

    // Helper function to check if a child node should be editable
    const isChildEditable = useCallback((child: Node): boolean => {
        // evidence under counterargument is not editable (AI generated)
        if (child.type === 'evidence' && node.type === 'counterargument') {
            return false;
        }
        // question and counterargument are never editable (AI generated)
        if (child.type === 'question' || child.type === 'counterargument') {
            return false;
        }
        return true;
    }, [node.type]);

    // Handler for adding new argument to evidence
    const handleAddArgumentToEvidence = useCallback((evidenceNodeId: string) => {
        params.then(resolvedParams => {
            // Navigate to create a new argument under the specified evidence
            router.push(`/research/${resolvedParams.assigmentId}/${evidenceNodeId}/new`);
        });
    }, [params, router]);

    // Handler for chat close button
    const handleChatClose = useCallback(() => {
        params.then(resolvedParams => {
            router.push(`/research/${resolvedParams.assigmentId}`);
        });
    }, [params, router]);

    // Handler for parent node click
    const handleParentNodeClick = useCallback(() => {
        // Don't add click functionality for subject nodes
        if (parentNode.type === 'subject') {
            return;
        }

        params.then(resolvedParams => {
            // If parent is evidence, redirect to the argument/counterargument that contains it
            if (parentNode.type === 'evidence') {
                // Find the argument/counterargument node that contains this evidence
                const argumentNode = findParentNode(exampleTree, parentNode.nodeId);
                if (argumentNode && (argumentNode.type === 'argument' || argumentNode.type === 'counterargument')) {
                    // Find the grandparent of the argument node
                    const grandParentNode = findParentNode(exampleTree, argumentNode.nodeId);
                    const grandParentId = grandParentNode?.nodeId || '0';

                    router.push(`/research/${resolvedParams.assigmentId}/${grandParentId}/${argumentNode.nodeId}`);
                    return;
                }
            }

            // For other node types (argument, counterargument, question, answer)
            const grandParentNode = findParentNode(exampleTree, parentNode.nodeId);
            const grandParentId = grandParentNode?.nodeId || '0'; // Use '0' as fallback for root

            router.push(`/research/${resolvedParams.assigmentId}/${grandParentId}/${parentNode.nodeId}`);
        });
    }, [parentNode, params, router]);

    const handleAddChildNode = useCallback(() => {
        setNode(prevNode => {
            const currentChildren = prevNode.children || [];
            const nextIndex = currentChildren.length + 1;
            const newChildId = `new-evidence-${nextIndex}`;

            const newChild: Node = {
                nodeId: newChildId,
                type: 'evidence',
                index: nextIndex,
                content: '',
                citation: [],
                children: null,
            };

            const updatedNode = {
                ...prevNode,
                children: [...currentChildren, newChild]
            };

            // Focus on the new textarea after state update
            setTimeout(() => {
                const newTextarea = document.querySelector(`textarea[data-node-id="${newChildId}"]`) as HTMLTextAreaElement;
                if (newTextarea) {
                    newTextarea.focus();
                }
            }, 0);

            return updatedNode;
        });
    }, []);
    useEffect(() => {
        const textareas = document.querySelectorAll('.node_editor__node__content');
        textareas.forEach((textarea) => {
            if (textarea instanceof HTMLTextAreaElement) {
                autoResize(textarea);
            }
        });
    }, [parentNode, node, autoResize]);

    useEffect(() => {
        console.log('Node Changed:', node);
    }, [node]);

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
                <div className='node_editor'>
                    {parentNode.nodeId && (<>
                        {/* parent node */}
                        < div
                            className={`node_editor__node node_editor__node--${parentNode.type} ${parentNode.type === 'evidence' && (node.type === 'argument' ? 'node_editor__node--evidence_counterargument' : 'node_editor__node--evidence_argument')}`}
                            onClick={parentNode.type !== 'subject' ? handleParentNodeClick : undefined}
                            style={parentNode.type !== 'subject' ? { cursor: 'pointer' } : {}}
                        >
                            <div className='node_editor__node__content_container'>
                                <div className='node_editor__node__title'>{`${getNodeTypeName(parentNode.type)} ${parentNode.index || ''}`}</div>
                                <div className='node_editor__node__content'>{parentNode.content}</div>
                            </div>
                        </div>
                        {/* current node */}
                        <div className={`node_editor__node node_editor__node--${node.type}`}>
                            <div className='node_editor__node__link'></div>
                            <div className='node_editor__node__content_container'>
                                <div className='node_editor__node__title'>{`${getNodeTypeName(node.type)}`}</div>
                                {node.type === 'question' || node.type === 'counterargument' ? (
                                    <div className='node_editor__node__content'>{node.content}</div>
                                ) : (
                                    <textarea
                                        className='node_editor__node__content'
                                        rows={1}
                                        placeholder='내용을 입력하세요'
                                        value={node.content}
                                        onChange={handleNodeContentChange}
                                    ></textarea>
                                )}
                            </div>
                            <div className='node_editor__node__children_container'>
                                {node.children && node.children.map((child) => (
                                    <div key={child.nodeId} className={`node_editor__node node_editor__node--${child.type}`}>
                                        <div className='node_editor__node__content_container'>
                                            <div className='node_editor__node__title'>{`${getNodeTypeName(child.type)} ${child.index || ''}`}</div>
                                            {!isChildEditable(child) ? (
                                                <div className='node_editor__node__content'>{child.content}</div>
                                            ) : (
                                                <textarea
                                                    className='node_editor__node__content'
                                                    data-node-id={child.nodeId}
                                                    rows={1}
                                                    placeholder='내용을 입력하세요'
                                                    value={child.content}
                                                    onChange={(e) => handleChildContentChange(child.nodeId, e.target.value, e)}
                                                ></textarea>
                                            )}
                                            {(child.citation && child.citation.length > 0) && (<>
                                                <div className='node_editor__node__title'>출처</div>
                                                {child.citation.map((cite, index) => (
                                                    <a className='node_editor__node__content' key={index} href={cite} target='_blank' rel='noopener noreferrer'>{cite}</a>
                                                ))}
                                            </>)}
                                        </div>
                                        {node.type === 'counterargument' && (
                                            <div className='btn node_editor__node__add_argument_btn' onClick={() => handleAddArgumentToEvidence(child.nodeId)}></div>
                                        )}
                                    </div>
                                ))}
                                {node.type === 'argument' && (
                                    <div className='btn node_editor__add_evidence_btn' onClick={handleAddChildNode}></div>
                                )}
                            </div>
                        </div>
                        <div className={`btn node_editor__register_node_btn ${hasChanges ? 'node_editor__register_node_btn--active' : ''}`} onClick={handleRegisterNode}>등록하기</div>
                    </>)}
                </div>
                <div className='node_editor__chat'>
                    <div className='btn chat__close_btn' onClick={handleChatClose}></div>
                    <Chat
                        status='open'
                        isClosable={false}
                        nodeId={node.nodeId}
                        mode={mode}
                        setMode={setMode}
                        setIsEditPanelOpen={setIsEditPanelOpen}
                        setEditData={setEditData}
                        setEditingMessageIndex={setEditingMessageIndex}
                        isEditPanelOpen={isEditPanelOpen}
                        hideButtons={true}
                    />
                </div>
            </div>
        </div >
    );
}

export default NodeEditor;
