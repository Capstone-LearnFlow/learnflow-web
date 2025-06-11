"use client";
import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Node, getNodeTypeName, TreeData } from '../../tree';
import { studentAPI } from '../../../../../services/api';
import { loadChatMessages } from '../../../../../services/supabase';
import ReactMarkdown from 'react-markdown';

interface NodeEditorProps {
    parentNode: Node;
    node: Node;
    setNode: React.Dispatch<React.SetStateAction<Node>>;
    hasChanges: boolean;
    params: Promise<{ assignmentId: string, parentNodeId: string, nodeId: string }>;
    originalNode: Node | null;
    setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
    setOriginalNode: React.Dispatch<React.SetStateAction<Node | null>>;
    treeData: TreeData | null;
}

const NodeEditor = ({
    parentNode,
    node,
    setNode,
    hasChanges,
    params,
    originalNode,
    setHasChanges,
    setOriginalNode,
    treeData
}: NodeEditorProps) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    // Helper function to find parent node of a given nodeId
    const findParentNode = useCallback((tree: Node, targetId: string): Node | null => {
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
    }, []);

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

        const validEvidences = currentNode.children.filter((child: Node) =>
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
                (currentNode.children && currentNode.children.some((child: Node) => child.content.trim() !== '')) || false;
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
    }, [node, checkForChanges, setHasChanges]);

    // Function to fetch chat history for the current node
    const fetchChatHistory = useCallback(async (assignmentId: string, parentNodeId: string, nodeId: string) => {
        try {
            const result = await loadChatMessages(assignmentId, parentNodeId, nodeId);
            if (result.success && result.data) {
                return result.data.map(message => 
                    `${message.sender === 'USER' ? '사용자' : 'AI'}: ${message.message}`
                ).join('\n\n');
            }
            return '';
        } catch (error) {
            console.error('Error fetching chat history:', error);
            return '';
        }
    }, []);

    // Function to extract top 3 citations from chat messages
    const extractTopCitations = useCallback(async (assignmentId: string, parentNodeId: string, nodeId: string) => {
        try {
            // Get chat messages
            const result = await loadChatMessages(assignmentId, parentNodeId, nodeId);
            
            if (result.success && result.data) {
                // Extract all citations from chat messages
                const allCitations: {text: string, url: string, title: string}[] = [];
                
                // Collect all citations from all messages
                result.data.forEach(message => {
                    if (message.citations && message.citations.length > 0) {
                        allCitations.push(...message.citations);
                    }
                });
                
                // Get only top 3 unique citations (based on URL)
                const uniqueUrls = new Set<string>();
                const topCitations: {text: string, url: string, title: string}[] = [];
                
                for (const citation of allCitations) {
                    if (!uniqueUrls.has(citation.url) && topCitations.length < 3) {
                        uniqueUrls.add(citation.url);
                        topCitations.push(citation);
                    }
                    
                    // Stop after we have 3 unique citations
                    if (topCitations.length >= 3) break;
                }
                
                console.log('Extracted top citations:', topCitations);
                return topCitations;
            }
            
            return [];
        } catch (error) {
            console.error('Error extracting citations from chat:', error);
            return [];
        }
    }, []);

    // Handler for register button click
    const handleRegisterNode = useCallback(async () => {
        if (!hasChanges || isLoading) {
            return;
        }

        // Additional validation for argument nodes
        if (node.type === 'argument' && !isArgumentValid(node)) {
            return;
        }

        setIsLoading(true);

        try {
            // Get the assignment ID from params
            const resolvedParams = await params;
            const assignmentId = resolvedParams.assignmentId;
            const parentNodeId = resolvedParams.parentNodeId;
            
            // Fetch chat history for this node
            const chatHistory = await fetchChatHistory(
                assignmentId,
                parentNodeId,
                node.nodeId === 'new' ? 'new-node' : node.nodeId
            );
            
            console.log('Starting node registration with top citations extraction...');
            
            // Extract top 3 citations from chat
            const topCitations = await extractTopCitations(
                assignmentId,
                parentNodeId,
                node.nodeId === 'new' ? 'new-node' : node.nodeId
            );
            
            console.log('Top citations extracted:', topCitations);

            // For main node creation (when parentNodeId is '0' and nodeId is 'new')
            // This handles adding an argument to a subject
            if (parentNode.type === 'subject' && node.nodeId === 'new' && node.type === 'argument') {
                // Format data according to the API requirements for main node
                const evidences = node.children
                    ? node.children.filter(child => child.type === 'evidence').map(child => {
                        const childIndex = child.index ? child.index - 1 : 0;
                        
                        // Try to use a citation from our top 3 citations if available
                        // Otherwise use the original citation or fallback, making sure to skip "출처" entries
                        const citation = childIndex < topCitations.length ? 
                            topCitations[childIndex].url : 
                            (child.citation && child.citation.length > 0 ? 
                                (child.citation[0] === "출처" && child.citation.length > 1 ? 
                                    child.citation[1] : child.citation[0]) : 
                                "https://example.com/source");
                        
                        console.log(`Evidence ${childIndex} - Using citation:`, citation);
                        
                        return {
                            content: child.content,
                            source: "",
                            url: citation
                        };
                    })
                    : [];

                const mainNodeData = {
                    title: parentNode.content, // Using subject node content as title
                    content: node.content,     // Using argument content as content
                    evidences: evidences
                };

                // Call the API to create the main node
                const response = await fetch(`/api/student/assignments/${assignmentId}/nodes`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(mainNodeData),
                });

                if (!response.ok) {
                    throw new Error(`Failed to create node: ${response.status}`);
                }

                const result = await response.json();

                // Navigate back to the assignment page to show the new tree
                if (result.status === 'success') {
                    router.push(`/research/${assignmentId}`);
                } else {
                    throw new Error('Failed to create argument node');
                }
            }
            // For adding argument responses to questions or evidence (from counterarguments)
            else if ((parentNode.type === 'question' || parentNode.type === 'evidence') && node.nodeId === 'new' && node.type === 'argument') {
                // Extract the numeric ID from the parent node ID (e.g., "q-123" -> 123, "e-456" -> 456)
                const targetIdMatch = parentNode.nodeId.match(/\d+/);
                if (!targetIdMatch) {
                    throw new Error('Invalid parent node ID format');
                }
                const targetId = parseInt(targetIdMatch[0], 10);

                // Determine target type based on parent node type
                const targetType = parentNode.type === 'question' ? 'NODE' : 'EVIDENCE';

                // Format evidences
                const evidences = node.children
                    ? node.children.filter(child => child.type === 'evidence').map(child => {
                        const childIndex = child.index ? child.index - 1 : 0;
                        
                        // Try to use a citation from our top 3 citations if available
                        // Otherwise use the original citation or fallback, making sure to skip "출처" entries
                        const citation = childIndex < topCitations.length ? 
                            topCitations[childIndex].url : 
                            (child.citation && child.citation.length > 0 ? 
                                (child.citation[0] === "출처" && child.citation.length > 1 ? 
                                    child.citation[1] : child.citation[0]) : 
                                "https://example.com/source");
                        
                        console.log(`Evidence ${childIndex} - Using citation:`, citation);
                        
                        return {
                            content: child.content,
                            source: "",
                            url: citation
                        };
                    })
                    : [];

                // Call the response API
                const result = await studentAPI.createResponse(
                    assignmentId,
                    targetType,
                    targetId,
                    node.content,
                    evidences
                );

                // Navigate back to the assignment page
                if (result.status === 'success') {
                    router.push(`/research/${assignmentId}`);
                } else {
                    throw new Error('Failed to create response');
                }
            }
            // Handle updating existing nodes (argument or answer types)
            else if (node.nodeId !== 'new' && (node.type === 'argument' || node.type === 'answer')) {
                // Extract numeric ID from node ID (e.g., "a-123" -> "123")
                const nodeIdMatch = node.nodeId.match(/\d+/);
                if (!nodeIdMatch) {
                    throw new Error('Invalid node ID format for update');
                }
                const numericNodeId = nodeIdMatch[0];

                // Format evidences for the API
                const evidences = node.children
                    ? node.children.filter(child => child.type === 'evidence').map(child => {
                        const childIndex = child.index ? child.index - 1 : 0;
                        
                        // Try to use a citation from our top 3 citations if available
                        // Otherwise use the original citation or fallback
                        const citation = childIndex < topCitations.length ? 
                            topCitations[childIndex].url : 
                            (child.citation && child.citation.length > 0 ? child.citation[0] : "https://example.com/source");
                        
                        console.log(`Evidence ${childIndex} - Using citation:`, citation);
                        
                        return {
                            content: child.content,
                            source: "",
                            url: citation
                        };
                    })
                    : [];

                // Call the update API
                const result = await studentAPI.updateNode(
                    assignmentId,
                    numericNodeId,
                    node.content,
                    evidences
                );

                console.log('Node updated successfully:', result);

                // Navigate back to the assignment page
                if (result.status === 'success') {
                    router.push(`/research/${assignmentId}`);
                } else {
                    throw new Error('Failed to update node');
                }
            } else {
                // For other cases, just reset the changes state
                console.log('No API call needed for this node type or state');

                // Reset changes state after successful registration
                setHasChanges(false);
                setOriginalNode(JSON.parse(JSON.stringify(node))); // Update original node to current state
            }
        } catch (error) {
            console.error('Error registering node:', error);
            alert('노드 등록에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [hasChanges, isLoading, node, parentNode, isArgumentValid, setHasChanges, setOriginalNode, params, router]);

    // Textarea auto-resize
    const autoResize = useCallback((textarea: HTMLTextAreaElement) => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }, []);

    const handleNodeContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setNode((prevNode: Node) => ({
            ...prevNode,
            content: newContent
        }));
        autoResize(e.target);
    }, [autoResize, setNode]);

    const handleChildContentChange = useCallback((childId: string, newContent: string, e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNode((prevNode: Node) => ({
            ...prevNode,
            children: prevNode.children?.map((child: Node) =>
                child.nodeId === childId
                    ? { ...child, content: newContent }
                    : child
            ) || null
        }));
        autoResize(e.target);
    }, [autoResize, setNode]);

    const handleChildKeyDown = useCallback((childId: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Handle backspace on empty evidence content
        if (e.key === 'Backspace') {
            const target = e.target as HTMLTextAreaElement;
            const content = target.value;

            // Only delete if content is completely empty and there are multiple evidence nodes
            if (content === '' && node.children && node.children.length > 1) {
                const evidenceChildren = node.children.filter((child: Node) => child.type === 'evidence');

                // Only delete if there are multiple evidence nodes
                if (evidenceChildren.length > 1) {
                    e.preventDefault();

                    setNode((prevNode: Node) => {
                        // Filter out the deleted child
                        const filteredChildren = prevNode.children?.filter((child: Node) => child.nodeId !== childId) || [];

                        // Update indexes only for evidence nodes
                        let evidenceIndex = 1;
                        const updatedChildren = filteredChildren.map((child: Node) => {
                            if (child.type === 'evidence') {
                                return {
                                    ...child,
                                    index: evidenceIndex++
                                };
                            }
                            return child;
                        });

                        return {
                            ...prevNode,
                            children: updatedChildren.length > 0 ? updatedChildren : null
                        };
                    });
                }
            }
        }
    }, [node.children, setNode]);

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
            router.push(`/research/${resolvedParams.assignmentId}/${evidenceNodeId}/new`);
        });
    }, [params, router]);

    // Handler for parent node click
    const handleParentNodeClick = useCallback(() => {
        // Don't add click functionality for subject nodes
        if (parentNode.type === 'subject') {
            return;
        }

        params.then(resolvedParams => {
            if (!treeData) return;

            // If parent is evidence, redirect to the argument/counterargument that contains it
            if (parentNode.type === 'evidence') {
                // Find the argument/counterargument node that contains this evidence
                const argumentNode = findParentNode(treeData.root, parentNode.nodeId);
                if (argumentNode && (argumentNode.type === 'argument' || argumentNode.type === 'counterargument')) {
                    // Find the grandparent of the argument node
                    const grandParentNode = findParentNode(treeData.root, argumentNode.nodeId);
                    const grandParentId = grandParentNode?.nodeId || '0';

                    router.push(`/research/${resolvedParams.assignmentId}/${grandParentId}/${argumentNode.nodeId}`);
                    return;
                }
            }

            // For other node types (argument, counterargument, question, answer)
            const grandParentNode = findParentNode(treeData.root, parentNode.nodeId);
            const grandParentId = grandParentNode?.nodeId || '0'; // Use '0' as fallback for root

            router.push(`/research/${resolvedParams.assignmentId}/${grandParentId}/${parentNode.nodeId}`);
        });
    }, [parentNode, params, router, treeData, findParentNode]);

    const handleAddChildNode = useCallback(() => {
        setNode((prevNode: Node) => {
            const currentChildren = prevNode.children || [];

            // Count only evidence nodes to determine the next index
            const evidenceChildren = currentChildren.filter((child: Node) => child.type === 'evidence');
            const nextIndex = evidenceChildren.length + 1;
            const newChildId = `new-evidence-${Date.now()}-${nextIndex}`; // Use timestamp to ensure uniqueness

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
    }, [setNode]);

    useEffect(() => {
        const textareas = document.querySelectorAll('.node_editor__node__content');
        textareas.forEach((textarea) => {
            if (textarea instanceof HTMLTextAreaElement) {
                autoResize(textarea);
            }
        });
    }, [parentNode, node, autoResize]);


    return (
        <div className='node_editor'>
            {parentNode.nodeId && (<>
                {/* parent node */}
                <div
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
                        {node.children && node.children.map((child: Node) => (
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
                                            onKeyDown={(e) => handleChildKeyDown(child.nodeId, e)}
                                        ></textarea>
                                    )}
                                    {/* Citation display */}
                                    {child.citation && Array.isArray(child.citation) && child.citation.length > 0 ? (
                                        <>
                                            <div className='node_editor__node__title'>출처</div>
                                            <div className='node_editor__node__content'>
                                                {child.citation.map((cite: string, index: number) => (
                                                    <ReactMarkdown key={index}>{cite}</ReactMarkdown>
                                                ))}
                                            </div>
                                        </>
                                    ) : null}
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
                <div className={`btn node_editor__register_node_btn ${hasChanges ? 'node_editor__register_node_btn--active' : ''} ${isLoading ? 'loading--default' : ''}`} onClick={handleRegisterNode}>
                    {!isLoading && (node.nodeId === 'new' ? '등록하기' : '수정하기')}
                </div>
            </>)}
        </div>
    );
};

export default NodeEditor;
