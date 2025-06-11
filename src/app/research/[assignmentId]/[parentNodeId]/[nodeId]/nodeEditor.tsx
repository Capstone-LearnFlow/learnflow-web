"use client";
import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Node, getNodeTypeName, TreeData } from '../../tree';
import { studentAPI } from '../../../../../services/api';
import { loadChatMessages } from '../../../../../services/supabase';

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

    // Function to call Cerebras API to generate formatted citations
    const generateFormattedCitations = useCallback(async (
        chatHistory: string, 
        citations: Array<{title: string, url: string, index: number}>
    ) => {
        try {
            // Create a message that includes chat history and citations
            const citationsText = citations.map(c => 
                `[${c.index + 1}] ${c.title}: ${c.url}`
            ).join('\n');
            
            const message = `
Chat History:
${chatHistory}

Citations:
${citationsText}
`;

            // Call Cerebras API
            const response = await fetch('/api/cerebras', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: message,
                    systemPrompt: "아래 주어진 채팅 내용과 인용(Citations)을 바탕으로, 각 인용에 대해 [title](url) 형식의 마크다운 링크를 생성해주세요. 제목은 간결하고 의미가 명확해야 합니다. 응답은 [title](url) 형식으로만 제공해주세요. 다른 설명이나 부가 정보는 필요하지 않습니다."
                }),
            });

            if (!response.ok) {
                throw new Error(`Cerebras API error: ${response.status}`);
            }

            // Read and process the streaming response
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Response body is null');
            }

            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fullText += decoder.decode(value, { stream: true });
            }

            // Process the response to remove content before </think>
            const thinkTagIndex = fullText.indexOf('</think>');
            if (thinkTagIndex !== -1) {
                // Remove everything up to and including </think>
                fullText = fullText.substring(thinkTagIndex + '</think>'.length).trim();
            }

            // Parse the markdown links
            const links: {[key: number]: string} = {};
            const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
            let match;
            let index = 0;
            
            while ((match = linkRegex.exec(fullText)) !== null) {
                if (citations[index]) {
                    links[citations[index].index] = match[0]; // Store the full [title](url) format
                    index++;
                }
            }

            return links;
        } catch (error) {
            console.error('Error generating formatted citations:', error);
            return {};
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
            
            console.log('Starting node registration with Cerebras API integration...');
            
            // Prepare citations from node's evidence children
            let allCitations: Array<{title: string, url: string, index: number}> = [];
            if (node.children) {
                node.children.forEach((child, idx) => {
                    if (child.type === 'evidence' && child.citation && child.citation.length > 0) {
                        allCitations.push({
                            title: child.citation[0], // Use first citation as title
                            url: child.citation.length > 1 ? child.citation[1] : child.citation[0], // Use second citation as URL if available
                            index: idx
                        });
                    }
                });
            }
            
            console.log('Collected citations:', allCitations);
            
            // Generate formatted citations using Cerebras API - await the result
            let formattedCitations: {[key: number]: string} = {};
            if (allCitations.length > 0) {
                console.log('Calling Cerebras API to generate formatted citations...');
                formattedCitations = await generateFormattedCitations(chatHistory, allCitations);
                console.log('Cerebras API response:', formattedCitations);
            }

            // For main node creation (when parentNodeId is '0' and nodeId is 'new')
            // This handles adding an argument to a subject
            if (parentNode.type === 'subject' && node.nodeId === 'new' && node.type === 'argument') {
                // Format data according to the API requirements for main node
                const evidences = node.children
                    ? node.children.filter(child => child.type === 'evidence').map(child => {
                        // Get the index for this child to find its formatted citation
                        const childIndex = child.index ? child.index - 1 : 0;
                        
                        // Try to get the formatted citation from Cerebras API result
                        // If not available, use original citation or fallback
                        const citationUrl = formattedCitations[childIndex] || 
                            (child.citation && child.citation.length > 0 ? child.citation[0] : "https://example.com/source");
                        
                        console.log(`Evidence ${childIndex} - Using citation URL:`, citationUrl);
                        
                        return {
                            content: child.content,
                            source: child.citation && child.citation.length > 0 ? child.citation[0] : "출처",
                            url: citationUrl
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
                        // Get the index for this child to find its formatted citation
                        const childIndex = child.index ? child.index - 1 : 0;
                        
                        // Try to get the formatted citation from Cerebras API result
                        // If not available, use original citation or fallback
                        const citationUrl = formattedCitations[childIndex] || 
                            (child.citation && child.citation.length > 0 ? child.citation[0] : "https://example.com/source");
                        
                        console.log(`Evidence ${childIndex} - Using citation URL:`, citationUrl);
                        
                        return {
                            content: child.content,
                            source: child.citation && child.citation.length > 0 ? child.citation[0] : "출처",
                            url: citationUrl
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
                        // Get the index for this child to find its formatted citation
                        const childIndex = child.index ? child.index - 1 : 0;
                        
                        // Try to get the formatted citation from Cerebras API result
                        // If not available, use original citation or fallback
                        const citationUrl = formattedCitations[childIndex] || 
                            (child.citation && child.citation.length > 0 ? child.citation[0] : "https://example.com/source");
                        
                        console.log(`Evidence ${childIndex} - Using citation URL:`, citationUrl);
                        
                        return {
                            content: child.content,
                            source: child.citation && child.citation.length > 0 ? child.citation[0] : "출처",
                            url: citationUrl
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
                                            {child.citation.map((cite: string, index: number) => (
                                                <a className='node_editor__node__content' key={index} href={cite} target='_blank' rel='noopener noreferrer'>{cite}</a>
                                            ))}
                                        </>
                                    ) : null
                                    }
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
