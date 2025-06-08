"use client";
import { useEffect, useState, useCallback, useRef, FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import StreamingMessage from './components/StreamingMessage';
import { saveChatMessage, loadChatMessages, searchRelevantMessages, ChatMessage } from '../../../services/supabase';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../engine/Auth';
import { NodeType } from './tree';

type ChatMode = 'ask' | 'create';
type ChatItemSender = "USER" | "AI";

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

// Define types for Gemini API responses
interface WebSource {
    uri: string;
    title: string;
}

interface GroundingChunk {
    web: WebSource;
}

// Define types for JSON edit panel
interface EditableFormData {
    assertion: string;
    evidences: string[];
}

interface Citation {
    text: string;
    url: string;
    title: string;
    index?: number;
}

type ChatItem = {
    sender: ChatItemSender;
    message: string;
    created_at: number;
    mode: ChatMode;
    suggestions?: string[];
    citations?: Citation[];
    hasForm?: boolean; // To identify if this message should contain a form
    jsonData?: EditableFormData; // To store the JSON data for editing
    nodeInfo?: {     // Information about the node this message is from (for retrieved messages)
        nodeId: string;
        parentNodeId: string;
        nodeName?: string;
    };
};

// Type for API history items
type ApiContentItem = {
    role: 'user' | 'model';
    parts: { text: string }[];
};

interface ChatProps {
    status: 'open' | 'closed';
    isClosable: boolean;
    nodeId: string;
    mode: ChatMode;
    setMode: (mode: ChatMode) => void;
    setIsEditPanelOpen: (isOpen: boolean) => void;
    setEditData: (data: EditableFormData | null) => void;
    setEditingMessageIndex: (index: number | null) => void;
    isEditPanelOpen: boolean;
    hideButtons?: boolean; // Optional prop to hide mode toggle buttons
    assignmentId?: string; // Optional prop for assignment ID
    parentNodeId?: string; // Optional prop for parent node ID
    getCurrentEditingContent?: () => EditingContent; // Function to get current editing content
    updateEditorContent?: (updates: EditorUpdates) => void; // Function to update editor content
};

// Type for the assertion form response
interface AssertionResponse {
    assertion: string;
    evidences: string[];
}

const Chat = ({
    status,
    isClosable,
    nodeId,
    mode,
    setMode,
    setIsEditPanelOpen,
    setEditData,
    setEditingMessageIndex,
    isEditPanelOpen,
    hideButtons = false, // Default to showing buttons
    assignmentId: propAssignmentId,
    parentNodeId: propParentNodeId,
    getCurrentEditingContent,
    updateEditorContent
}: ChatProps) => {
    // Get parameters from route if not provided as props
    const params = useParams<{ assignmentId: string, parentNodeId: string, nodeId: string }>();
    const assignmentId = propAssignmentId || params?.assignmentId || '';
    const parentNodeId = propParentNodeId || params?.parentNodeId || '0';
    const [viewStatus, setViewStatus] = useState<'open' | 'closed'>(status);
    const [chatLog, setChatLog] = useState<ChatItem[]>([]);
    const [inputValue, setInputValue] = useState<string>('');
    const [responseStatus, setResponseStatus] = useState<'streaming' | 'success' | 'error'>('success');
    const [streamingMessage, setStreamingMessage] = useState<string>('');
    const [streamingSuggestions, setStreamingSuggestions] = useState<string[]>([]);
    const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
    const [hasAskedQuestion, setHasAskedQuestion] = useState<boolean>(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const apiHistoryRef = useRef<ApiContentItem[]>([]);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    // Form state
    const [assertion, setAssertion] = useState<string>('');
    const [evidence, setEvidence] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [formSubmitted, setFormSubmitted] = useState<boolean>(false);
    // Get user information from auth context
    const { user } = useAuth();

    // Load chat logs from Supabase on component mount
    useEffect(() => {
        const fetchChatLogs = async () => {
            if (!assignmentId || !nodeId) {
                setIsLoading(false);
                return;
            }

            try {
                // Load all messages for this node without filtering by user
                const result = await loadChatMessages(assignmentId, parentNodeId, nodeId);

                if (result.success && result.data) {
                    // Convert Supabase messages to ChatItem format
                    const loadedMessages: ChatItem[] = result.data.map(message => ({
                        sender: message.sender,
                        message: message.message,
                        created_at: new Date(message.created_at || Date.now()).getTime(),
                        mode: message.mode,
                        suggestions: message.suggestions,
                        citations: message.citations,
                        hasForm: false
                    }));

                    // Add any existing messages to API history for context
                    const apiHistory: ApiContentItem[] = [];
                    loadedMessages.forEach(msg => {
                        apiHistory.push({
                            role: msg.sender === 'USER' ? 'user' : 'model',
                            parts: [{ text: msg.message }]
                        });
                    });

                    if (apiHistory.length > 0) {
                        apiHistoryRef.current = apiHistory;
                    }

                    // Set loaded messages to state
                    if (loadedMessages.length > 0) {
                        setChatLog(loadedMessages);
                        setHasAskedQuestion(loadedMessages.some(msg => msg.sender === 'USER'));
                    }
                }
            } catch (error) {
                console.error('Error loading chat logs:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchChatLogs();
    }, [assignmentId, parentNodeId, nodeId]);

    // Function to find relevant messages based on embeddings
    const findRelevantMessages = async (messageText: string): Promise<ChatItem[]> => {
        // Only search for relevant messages in the global chat
        if (nodeId !== '0' || !assignmentId) return [];

        try {
            // Search for relevant messages using embeddings
            const result = await searchRelevantMessages(assignmentId, messageText, 5);
            
            if (result.success && result.data && result.data.length > 0) {
                // Convert to ChatItem format and add node info
                return result.data
                    .filter(message => 
                        // Filter out messages from the current chat (nodeId '0')
                        message.node_id !== '0' &&
                        // Only include relevant messages with high similarity
                        message.message.trim().length > 0
                    )
                    .map(message => ({
                        sender: message.sender,
                        message: message.message,
                        created_at: new Date(message.created_at || Date.now()).getTime(),
                        mode: message.mode,
                        suggestions: message.suggestions,
                        citations: message.citations,
                        hasForm: false,
                        nodeInfo: {
                            nodeId: message.node_id,
                            parentNodeId: message.parent_node_id,
                            nodeName: `노드 ${message.node_id}`, // Default node name, could be replaced with actual node name
                        }
                    }));
            }
        } catch (error) {
            console.error('Error finding relevant messages:', error);
        }
        
        return [];
    };
    useEffect(() => {
        setViewStatus(status);
    }, [status]);
    // Function to save chat message to Supabase
    const saveChatMessageToSupabase = async (message: ChatItem) => {
        if (!assignmentId || !nodeId) return;

        try {
            // Don't save embeddings for global chat (nodeId='0')
            const skipEmbedding = nodeId === '0';
            
            await saveChatMessage({
                assignment_id: assignmentId,
                parent_node_id: parentNodeId,
                node_id: nodeId,
                sender: message.sender,
                message: message.message,
                mode: message.mode,
                user_id: user?.id,        // Include user ID if available
                user_name: user?.name,    // Include user name if available
                suggestions: message.suggestions,
                citations: message.citations,
                skip_embedding: skipEmbedding // Flag to skip embedding generation for global chat
            });
        } catch (error) {
            console.error('Error saving chat message to Supabase:', error);
        }
    };
    // Function to process text and replace citation numbers with linked citations
    const insertInlineCitations = (text: string, citations?: Citation[]): string => {
        if (!citations || citations.length === 0) {
            return text;
        }

        // Create a map of citation text to citation object for quick lookup
        const citationMap = new Map<string, Citation>();
        citations.forEach(citation => {
            citationMap.set(citation.text, citation);
        });

        // Replace all citation references in text with markdown links
        // Using a regex to match citation patterns like [1], [2], etc.
        return text.replace(/\[(\d+)\]/g, (match) => {
            const citation = citationMap.get(match);
            
            if (citation && citation.url) {
                // Return markdown link format for ReactMarkdown to render
                return `[${match}](${citation.url})`;
            }
            
            // If no matching citation found, return the original text
            return match;
        });
    };
    // Function to scroll to the bottom of the chat
    const scrollToBottom = useCallback(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, []);
    useEffect(() => {
        // Clean up any ongoing fetch request when component unmounts
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);
    // Scroll to bottom when chat log changes
    useEffect(() => {
        scrollToBottom();
    }, [chatLog, scrollToBottom]);
    // Scroll to bottom when streaming message changes
    useEffect(() => {
        if (streamingMessage) {
            scrollToBottom();
        }
    }, [streamingMessage, scrollToBottom]);
    // Reference for the scroll anchor element
    // const scrollAnchorRef = useRef<HTMLDivElement>(null);
    // Disable auto scrolling completely
    // This basic scroll function is only used for initial messages
    const manualScrollToBottom = useCallback(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, []);

    // Only scroll for the very first message, then let user control
    useEffect(() => {
        if (chatLog.length === 1) {
            // Only auto-scroll for the first message
            setTimeout(manualScrollToBottom, 100);
        }
    }, [chatLog.length, manualScrollToBottom]);

    // Remove IntersectionObserver that forces scroll

    // Remove additional auto-scroll effects

    // Fetch response from OpenAI (for global chat)
    const fetchOpenAIResponse = useCallback(async (message: string) => {
        try {
            // Create a new AbortController for this request
            abortControllerRef.current = new AbortController();
            const signal = abortControllerRef.current.signal;

            setResponseStatus('streaming');
            setStreamingMessage('');
            setStreamingSuggestions([]);
            setStreamingCitations([]);

            // For global chat, find relevant messages from other nodes using embeddings
            let relevantMessages: ChatItem[] = [];
            relevantMessages = await findRelevantMessages(message);
            
            // If we found relevant messages, add them to the chat log
            if (relevantMessages.length > 0) {
                // Add an AI message indicating relevant chats were found
                const relevantInfoMessage: ChatItem = {
                    sender: "AI",
                    message: "다른 노드에서 관련된 대화를 찾았습니다:",
                    created_at: Date.now(),
                    mode: mode,
                };
                
                // Add the relevant messages to the chat log
                setChatLog(prev => [...prev, relevantInfoMessage, ...relevantMessages]);
            }

            // Add the new user message to API history
            apiHistoryRef.current = [
                ...apiHistoryRef.current,
                {
                    role: 'user',
                    parts: [{ text: message }]
                }
            ];

            // Add context from relevant messages to the API request
            let contextualHistory = apiHistoryRef.current.slice(0, -1);
            if (relevantMessages.length > 0) {
                // Add relevant messages as context for the AI
                const relevantContext = relevantMessages.map(msg => ({
                    role: msg.sender.toLowerCase() as 'user' | 'model',
                    parts: [{ 
                        text: `[노드 ${msg.nodeInfo?.nodeId}] ${msg.sender === 'USER' ? '사용자' : 'AI'}: ${msg.message}`
                    }]
                }));
                
                // Insert the relevant context before the latest user message
                contextualHistory = [
                    ...apiHistoryRef.current.slice(0, -1),
                    ...relevantContext
                ];
            }

            // Use OpenAI's gpt-4.1-mini API instead of Perplexity for global chat
            const response = await fetch('/api/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: message,
                    history: contextualHistory.map(item => 
                        `${item.role === 'user' ? '사용자' : 'AI'}: ${item.parts[0].text}`
                    ).join('\n\n'),
                    stream: true, // Request streaming response
                    model: 'gpt-4.1-mini' // Specify the model to use
                }),
                signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Response body is null');
            }

            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;
                setStreamingMessage(fullText);
            }

            // Add the AI response to API history for context in future requests
            apiHistoryRef.current = [
                ...apiHistoryRef.current,
                {
                    role: 'model',
                    parts: [{ text: fullText }]
                }
            ];

            // Add the AI response to the chat log
            const aiResponse: ChatItem = {
                sender: "AI",
                message: fullText,
                created_at: Date.now(),
                mode: mode,
            };

            setChatLog((prev) => [...prev, aiResponse]);
            // Save AI response to Supabase
            await saveChatMessageToSupabase(aiResponse);

            setStreamingMessage('');
            setResponseStatus('success');

            // Mark that the user has asked at least one question
            setHasAskedQuestion(true);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                // Fetch was aborted
            } else {
                console.error('Error fetching OpenAI response:', error);
                setResponseStatus('error');
            }
        } finally {
            abortControllerRef.current = null;
        }
    }, [setChatLog, setStreamingMessage, setStreamingSuggestions, setStreamingCitations, setResponseStatus, setHasAskedQuestion, mode, assignmentId, findRelevantMessages]);

    // Fetch response from Perplexity (for node-specific chats)
    const fetchPerplexityResponse = useCallback(async (message: string) => {
        try {
            // Create a new AbortController for this request
            abortControllerRef.current = new AbortController();
            const signal = abortControllerRef.current.signal;

            setResponseStatus('streaming');
            setStreamingMessage('');
            setStreamingSuggestions([]);
            setStreamingCitations([]);

            // Add the new user message to API history
            apiHistoryRef.current = [
                ...apiHistoryRef.current,
                {
                    role: 'user',
                    parts: [{ text: message }]
                }
            ];

            const contextualHistory = apiHistoryRef.current.slice(0, -1);

            const response = await fetch('/api/perplexity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    history: contextualHistory // Send history context
                }),
                signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Response body is null');
            }

            const decoder = new TextDecoder();
            let fullText = '';
            let citations: Citation[] = [];
            let suggestions: string[] = [];

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });

                // Split by newline to handle JSON objects separated by newlines
                const jsonStrings = chunk.split('\n').filter(str => str.trim());

                for (const jsonStr of jsonStrings) {
                    try {
                        const data = JSON.parse(jsonStr);

                        // Handle regular text chunks from various formats of API response
                        if (data.text) {
                            // Direct text property (simplified format)
                            fullText += data.text;
                            setStreamingMessage(fullText);
                            // No auto-scrolling
                        } else if (data.choices && data.choices[0] && data.choices[0].delta) {
                            // Handle the OpenAI/Perplexity format
                            const deltaContent = data.choices[0].delta;
                            if (deltaContent.content) {
                                fullText += deltaContent.content;
                                setStreamingMessage(fullText);
                                // No auto-scrolling
                            }
                        }

                        // Handle citation data from Gemini (sent after all text chunks)
                        if (data.type === 'citations' && data.groundingMetadata) {
                            const { groundingMetadata, segmentMapping } = data;

                            // Extract suggestions
                            if (groundingMetadata.webSearchQueries && groundingMetadata.webSearchQueries.length > 0) {
                                suggestions = groundingMetadata.webSearchQueries;
                                setStreamingSuggestions(suggestions);
                            }

                            // Extract citations if available
                            if (groundingMetadata.groundingChunks && groundingMetadata.groundingChunks.length > 0) {
                                citations = groundingMetadata.groundingChunks
                                    .filter((chunk: any) => chunk.web && chunk.web.uri)
                                    .map((chunk: any, index: number) => ({
                                        text: `[${index + 1}]`,
                                        url: chunk.web.uri,
                                        title: chunk.web.title || `Source ${index + 1}`,
                                        index: index
                                    }));
                                setStreamingCitations(citations);
                                
                                // If we have segment mapping, insert citation references into the text
                                if (segmentMapping && segmentMapping.length > 0) {
                                    // Process the text to add inline citations
                                    fullText = insertInlineCitations(fullText, citations);
                                    setStreamingMessage(fullText);
                                    // No auto-scrolling
                                }
                            }
                        }
                        
                        // Handle Perplexity's citation data format
                        if (data.citations || data.search_results) {
                            if (data.citations && data.citations.length > 0) {
                                const citationUrls = data.citations;
                                const searchResults = data.search_results || [];
                                
                                citations = citationUrls.map((url: string, index: number) => {
                                    const result = searchResults[index] || {};
                                    return {
                                        text: `[${index + 1}]`,
                                        url: url,
                                        title: result.title || `Source ${index + 1}`,
                                        index: index
                                    };
                                });
                                
                                setStreamingCitations(citations);
                            }
                        }
                    } catch (e) {
                        // Handle parse errors (could be partial chunks)
                        console.error('Error parsing JSON from stream', e);
                    }
                }
            }

            // Add the AI response to API history for context in future requests
            apiHistoryRef.current = [
                ...apiHistoryRef.current,
                {
                    role: 'model',
                    parts: [{ text: fullText }]
                }
            ];

            // Add the AI response to the chat log
            const aiResponse: ChatItem = {
                sender: "AI",
                message: fullText,
                created_at: Date.now(),
                mode: mode,
                suggestions,
                citations
            };

            setChatLog((prev) => [...prev, aiResponse]);
            // Save AI response to Supabase
            await saveChatMessageToSupabase(aiResponse);

            setStreamingMessage('');
            setStreamingSuggestions([]);
            setStreamingCitations([]);
            setResponseStatus('success');

            // Mark that the user has asked at least one question
            setHasAskedQuestion(true);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                // Fetch was aborted
            } else {
                console.error('Error fetching Perplexity response:', error);
                setResponseStatus('error');
            }
        } finally {
            abortControllerRef.current = null;
        }
    }, [setChatLog, setStreamingMessage, setStreamingSuggestions, setStreamingCitations, setResponseStatus, setHasAskedQuestion, mode, assignmentId, parentNodeId, nodeId]);

    // Function to send an assertion to OpenAI API - modified to directly open edit panel
    const sendAssertionToOpenAI = async (assertionText: string, evidenceText: string) => {
        try {
            setIsSubmitting(true);

            // Combine the texts for API request (but don't add to chat)
            const displayText = `주장: ${assertionText}\n\n근거: ${evidenceText}`;

            // Call OpenAI API
            const response = await fetch('/api/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: `${displayText}\n\n${apiHistoryRef.current.map(item => `${item.role === 'user' ? '사용자' : 'AI'}: ${item.parts[0].text}`).join('\n\n')}`
                }),
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            // Parse the response data with error handling
            const responseText = await response.text();

            try {
                // Try to parse the response - it might be a string representation of JSON
                let parsedData;

                try {
                    // First attempt to parse the response text
                    parsedData = JSON.parse(responseText);

                    // If parsedData is a string (doubly stringified JSON), parse it again
                    if (typeof parsedData === 'string') {
                        try {
                            parsedData = JSON.parse(parsedData);
                        } catch (innerErr) {
                            console.error("Error parsing inner JSON string:", innerErr);
                        }
                    }
                } catch (parseErr) {
                    console.error("Error in initial JSON parsing:", parseErr);
                    throw new Error("Failed to parse response");
                }

                // Validate the structure
                if (!parsedData || typeof parsedData !== 'object') {
                    console.error("Invalid data format after parsing:", parsedData);
                    throw new Error('Invalid response format - not an object');
                }

                // Check if expected properties exist
                if (!('assertion' in parsedData) || !('evidences' in parsedData)) {
                    console.error("Missing required fields in response:", parsedData);
                    throw new Error('Invalid response format - missing required fields');
                }

                // Create a safe data object with proper defaults
                const safeData: AssertionResponse = {
                    assertion: parsedData.assertion || '주장 내용이 없습니다.',
                    evidences: Array.isArray(parsedData.evidences) ? parsedData.evidences : []
                };

                // Directly set the edit data and open the edit panel
                setEditData(safeData);

                // Set a dummy index since we're not adding to chat log
                setEditingMessageIndex(0);

                // Open the edit panel
                setIsEditPanelOpen(true);

                // Keep form values (removed reset logic)
            } catch (parseError) {
                console.error('Error parsing response:', parseError);
                // Show error message in chat
                const errorMessage: ChatItem = {
                    sender: "AI",
                    message: "죄송합니다. 응답을 처리하는 중 오류가 발생했습니다.",
                    created_at: Date.now(),
                    mode: 'create',
                };
                setChatLog((prev) => [...prev, errorMessage]);
                await saveChatMessageToSupabase(errorMessage);
            }
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
            // Show error message in chat
            const errorMessage: ChatItem = {
                sender: "AI",
                message: "죄송합니다. 요청을 처리하는 중 오류가 발생했습니다.",
                created_at: Date.now(),
                mode: 'create',
            };
            setChatLog((prev) => [...prev, errorMessage]);
            await saveChatMessageToSupabase(errorMessage);
        } finally {
            setIsSubmitting(false);
            setResponseStatus('success');
            setStreamingMessage('');
        }
    };

    // Handle form submission
    const handleFormSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (assertion.trim() && evidence.trim() && !isSubmitting && !formSubmitted) {
            // Mark form as submitted to disable further edits
            setFormSubmitted(true);

            // First ensure edit panel is closed before submitting
            setIsEditPanelOpen(false);

            // Then send data to OpenAI
            sendAssertionToOpenAI(assertion, evidence);

            // Clear active form after submission
        }
    };

    // Function to add form message to chat
    const addFormMessageToChat = useCallback(async () => {
        const aiFormMessage: ChatItem = {
            sender: "AI",
            message: "주장과 근거를 작성해주세요:", // "Please write your assertion and evidence:"
            created_at: Date.now(),
            mode: 'create',
            hasForm: true,
        };

        setChatLog((prev) => [...prev, aiFormMessage]);
        // Save form message to Supabase
        await saveChatMessageToSupabase(aiFormMessage);

        // Reset form fields and submission state
        setAssertion('');
        setEvidence('');
        setFormSubmitted(false);
    }, [setChatLog, setAssertion, setEvidence, assignmentId, parentNodeId, nodeId]);

    // Add form message when mode changes to 'create'
    useEffect(() => {
        if (mode === 'create' && responseStatus === 'success') {
            addFormMessageToChat();
        }
    }, [mode, addFormMessageToChat, responseStatus]);
    // Advanced duplicate prevention system
    const isProcessingMessageRef = useRef<boolean>(false);
    const sentMessagesRef = useRef<Set<string>>(new Set());
    const DUPLICATE_PREVENTION_TIMEOUT = 3000; // 3 seconds to prevent exact duplicate messages

    // Generate a unique ID for each message to track duplicates
    const generateMessageId = (text: string, timestamp: number): string => {
        return `${text.trim()}_${timestamp}`;
    };

    const sendMessage = useCallback(async (text: string = inputValue) => {
        const trimmedText = text.trim();

        // Basic validation
        if (trimmedText === '' || responseStatus === 'streaming') return;

        // Create a timestamp for this message attempt
        const now = Date.now();
        const messageId = generateMessageId(trimmedText, now);

        // Check if we're already processing a message or if this exact message was sent recently
        if (isProcessingMessageRef.current || sentMessagesRef.current.has(messageId)) {
            console.log('Prevented duplicate submission:', trimmedText);
            return;
        }

        // Advanced check - look for very recent identical content regardless of timestamp
        let isDuplicate = false;

        // Convert Set to Array for iteration (fixes TypeScript error)
        const recentMessages = Array.from(sentMessagesRef.current);

        // Check for any recent identical message content
        for (let i = 0; i < recentMessages.length; i++) {
            const existingId = recentMessages[i];
            const parts = existingId.split('_');

            // Ensure we have valid parts
            if (parts.length >= 2) {
                const existingText = parts[0];
                const timestampStr = parts[parts.length - 1]; // Take the last part as timestamp
                const timestamp = parseInt(timestampStr, 10);

                // If we find the same message text sent within the prevention timeout window
                if (existingText === trimmedText && !isNaN(timestamp) &&
                    (now - timestamp) < DUPLICATE_PREVENTION_TIMEOUT) {
                    isDuplicate = true;
                    console.log('Prevented duplicate message:', existingText);
                    break;
                }
            }
        }

        if (isDuplicate) return;

        // Mark as processing and remember this message
        isProcessingMessageRef.current = true;
        sentMessagesRef.current.add(messageId);

        // Clean up old message IDs periodically
        setTimeout(() => {
            sentMessagesRef.current.delete(messageId);
        }, DUPLICATE_PREVENTION_TIMEOUT);

        try {
            console.log('Sending message:', trimmedText, 'with ID:', messageId);

            // Create user message
            const newChatItem: ChatItem = {
                sender: "USER",
                message: trimmedText,
                created_at: now,
                mode: mode,
            };

            // Update UI with new message
            setChatLog((prev) => [...prev, newChatItem]);

            // Save message to database
            await saveChatMessageToSupabase(newChatItem);

            // Clear input field
            setInputValue('');

            // Only process in 'ask' mode
            if (mode === 'ask') {
                // Use different API based on whether it's the global chat or node-specific chat
                if (nodeId === '0') {
                    // Use OpenAI for global chat
                    await fetchOpenAIResponse(trimmedText);
                } else {
                    // Use Perplexity for node-specific chats
                    await fetchPerplexityResponse(trimmedText);
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            // Reset processing flag with a short delay
            setTimeout(() => {
                isProcessingMessageRef.current = false;
            }, 300);
        }
    }, [inputValue, mode, responseStatus, fetchPerplexityResponse, fetchOpenAIResponse, setChatLog, setInputValue, nodeId]);
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim() !== '' && responseStatus !== 'streaming') {
            e.preventDefault(); // Prevent default behavior to avoid double submission
            sendMessage();
        }
    };
    // Handle suggestion button click
    const handleSuggestionClick = (suggestion: string) => {
        if (responseStatus !== 'streaming') {
            sendMessage(suggestion);
        }
    };
    // Render a citation link
    const renderCitation = (citation: Citation) => {
        return (
            <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="chat__citation-link"
                title={citation.title}
            >
                {citation.text}
            </a>
        );
    };
    // Render markdown content with proper citation display
    const renderMarkdown = (message: string, citations?: Citation[], nodeInfo?: ChatItem['nodeInfo']) => {
        // Process the message to add citation links if citations are available
        const processedMessage = citations && citations.length > 0 ? 
            insertInlineCitations(message, citations) : message;
        
        // If this is a message from another node, add a prefix to indicate which node it's from
        const displayMessage = nodeInfo ? 
            `**노드 ${nodeInfo.nodeId}에서의 대화:**\n\n${processedMessage}` : 
            processedMessage;
            
        return (
            <div className={`chat__markdown-content ${nodeInfo ? 'chat__markdown-content--node-message' : ''}`}>
                <ReactMarkdown>
                    {displayMessage}
                </ReactMarkdown>
            </div>
        );
    };


    return (
        viewStatus === 'open' ? (
            <div className="card card--chat">
                {isClosable && (<div className='btn chat__close_btn' onClick={() => setViewStatus('closed')}></div>)}
                {isLoading && (
                    <div className="chat__loading">
                        <div className="chat__loading-spinner"></div>
                        <p>채팅 기록을 불러오는 중...</p>
                    </div>
                )}
                <div className="chat-container">
                    <div className={`chat__stack ${isEditPanelOpen ? 'chat__stack--with-panel' : ''}`} ref={chatContainerRef}>
                        {/* Streaming message using dedicated component for consistent white background */}
                        {responseStatus === 'streaming' && (
                            <StreamingMessage
                                content={streamingMessage}
                                citations={streamingCitations}
                                suggestions={streamingSuggestions}
                                onSuggestionClick={handleSuggestionClick}
                            />
                        )}
                        {/* Existing chat log */}
                        {chatLog.toReversed().map((item, i) => (
                            <div key={i} className={`chat__stack__item ${item.sender === "USER" && 'chat__stack__item--bubble'}`}>
                                {item.sender === "AI" ? (
                                    <>
                                        {renderMarkdown(item.message, item.citations, item.nodeInfo)}

                                        {/* Show the assertion form inside AI message */}
                                        {item.hasForm && (
                                            <div className="chat__inline-form">
                                                <form onSubmit={handleFormSubmit} className={isSubmitting ? 'form-submitting' : ''}>
                                                    {/* Loading overlay - visible when form is submitting */}
                                                    {isSubmitting && (
                                                        <div className="form-processing-overlay">
                                                            <div className="processing-spinner"></div>
                                                            <p className="processing-text">데이터를 처리하는 중입니다...</p>
                                                            <div className="typing-indicator processing-indicator">
                                                                <span></span>
                                                                <span></span>
                                                                <span></span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="assertion-form__field">
                                                        <label htmlFor="assertion">주장</label>
                                                        <textarea
                                                            id="assertion"
                                                            value={assertion}
                                                            onChange={(e) => !formSubmitted && setAssertion(e.target.value)}
                                                            placeholder="주장을 입력해주세요..."
                                                            rows={3}
                                                            required
                                                            disabled={isSubmitting || formSubmitted}
                                                            readOnly={formSubmitted}
                                                        />
                                                    </div>
                                                    <div className="assertion-form__field">
                                                        <label htmlFor="evidence">근거</label>
                                                        <textarea
                                                            id="evidence"
                                                            value={evidence}
                                                            onChange={(e) => !formSubmitted && setEvidence(e.target.value)}
                                                            placeholder="근거를 입력해주세요..."
                                                            rows={5}
                                                            required
                                                            disabled={isSubmitting || formSubmitted}
                                                            readOnly={formSubmitted}
                                                        />
                                                    </div>
                                                    <div className="assertion-form__actions">
                                                        <button
                                                            type="submit"
                                                            className="assertion-form__button assertion-form__button--submit"
                                                            disabled={isSubmitting || !assertion.trim() || !evidence.trim() || formSubmitted}
                                                        >
                                                            {isSubmitting ? '제출 중...' : '확인'}
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        )}

                                        {/* Citation sources section removed as per user request */}

                                        {/* Show suggestions */}
                                        {item.suggestions && Array.isArray(item.suggestions) && item.suggestions.length > 0 && (
                                            <div className="chat__suggestions">
                                                {item.suggestions.map((suggestion, idx) => (
                                                    <button
                                                        key={idx}
                                                        className="chat__suggestion-button"
                                                        onClick={() => handleSuggestionClick(suggestion)}
                                                        disabled={responseStatus === 'streaming'}
                                                    >
                                                        {suggestion}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    item.message
                                )}
                            </div>
                        ))}


                        {/* Scroll anchor element - always stays at the bottom */}
                        {/* <div ref={scrollAnchorRef} className="scroll-anchor"></div> */}
                    </div>
                </div>

                {/* <div className="chat__input-container"> */}
                {/* <div className="chat__input-stack"> */}
                {/* Mode toggle buttons positioned horizontally above input */}
                {!hideButtons && (
                    <div className="chat__toggle-area">
                        <button
                            className={`chat__mode-button ${mode === 'ask' ? 'chat__mode-button--active' : ''}`}
                            onClick={() => setMode('ask')}
                            disabled={responseStatus === 'streaming'}
                        >
                            질문하기
                        </button>
                        <button
                            className={`chat__mode-button ${mode === 'create' ? 'chat__mode-button--active' : ''}`}
                            onClick={() => setMode('create')}
                            disabled={responseStatus === 'streaming' || !hasAskedQuestion}
                        >
                            생성하기
                        </button>
                    </div>
                )}

                {/* Input field with full width */}
                <div className="chat__input">
                    <input
                        type="text"
                        className="chat__input__text"
                        placeholder={mode === 'ask' ? "질문하기..." : "생성할 내용 입력..."}
                        value={inputValue || ''}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={responseStatus === 'streaming'}
                    />
                    <button
                        className={`chat__input__button ${(inputValue && responseStatus !== 'streaming') && 'chat__input__button--active'}`}
                        onClick={(e) => {
                            // Ensure event isn't processed more than once
                            e.stopPropagation();
                            // Only process if button isn't disabled
                            if (responseStatus !== 'streaming' && inputValue.trim() !== '') {
                                sendMessage();
                            }
                        }}
                        disabled={responseStatus === 'streaming' || inputValue.trim() === ''}
                    ></button>
                </div>

                <style jsx>{`
                /* Chat container */
                .chat-container {
                    display: flex;
                    width: 100%;
                    flex: 1;
                    overflow: hidden;
                }
                
                /* In-chat form styles */
                .chat__inline-form {
                    margin-top: 20px;
                    padding: 16px;
                    background-color: #eef4ff;
                    border-radius: 12px;
                    width: 100%;
                    min-width: 100%;
                    box-sizing: border-box;
                }
                
                .assertion-form__field {
                    margin-bottom: 16px;
                    position: relative;
                    background-color: #ffffff;
                    border-radius: 8px;
                    padding: 12px 12px 12px 20px;
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    width: 100%;
                    box-sizing: border-box;
                }
                
                /* Green vertical bar for assertion (주장) */
                .assertion-form__field:first-of-type::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 6px;
                    background-color: #4caf50;
                    border-top-left-radius: 12px;
                    border-bottom-left-radius: 12px;
                }
                
                /* Red vertical bar for evidence (근거) */
                .assertion-form__field:not(:first-of-type)::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 6px;
                    background-color: #e74c3c;
                    border-top-left-radius: 12px;
                    border-bottom-left-radius: 12px;
                }
                
                .assertion-form__field label {
                    display: block;
                    margin-bottom: 12px;
                    font-weight: bold;
                    color: #444;
                }
                
                /* Green label color for assertion (주장) */
                .assertion-form__field:first-of-type label {
                    color: #4caf50;
                }
                
                /* Red label color for evidence (근거) */
                .assertion-form__field:not(:first-of-type) label {
                    color: #e74c3c;
                }
                
                .assertion-form__field textarea {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    resize: vertical;
                    font-family: inherit;
                    font-size: 15px;
                    background-color: #ffffff;
                    box-sizing: border-box;
                    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
                }
                
                .assertion-form__field textarea:focus {
                    outline: none;
                    border-color: #0078ff;
                    background-color: white;
                }
                
                .assertion-form__actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 8px;
                    padding-right: 4px;
                }
                
                .assertion-form__button {
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                }
                
                .assertion-form__button--cancel {
                    background-color: #f0f0f0;
                    color: #666;
                }
                
                .assertion-form__button--cancel:hover {
                    background-color: #e0e0e0;
                }
                
                .assertion-form__button--submit {
                    background-color: #7fbf84;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 6px;
                }
                
                .assertion-form__button--submit:hover {
                    background-color: #43a047;
                }
                
                .assertion-form__button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                /* Form submitting state */
                .form-submitting {
                    position: relative;
                }
                
                /* Processing overlay styling */
                .form-processing-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(240, 247, 255, 0.85);
                    backdrop-filter: blur(3px);
                    z-index: 100;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    border-radius: 12px;
                    animation: fadeIn 0.3s ease-in-out;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                .processing-spinner {
                    width: 50px;
                    height: 50px;
                    border: 4px solid rgba(76, 175, 80, 0.2);
                    border-radius: 50%;
                    border-top-color: #4caf50;
                    animation: spin 1s linear infinite;
                    margin-bottom: 16px;
                }
                
                .processing-text {
                    font-size: 16px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 16px;
                    text-align: center;
                }
                
                .processing-indicator {
                    margin-top: 0;
                }
                
                .processing-indicator span {
                    height: 10px;
                    width: 10px;
                    background-color: #4caf50;
                }
                /* Vertical stack for input and toggle */
                
                /* Main chat container */
                
                
                .chat__stack--with-panel {
                    width: 100%;
                }
                
                /* Basic message item styling */
                
                /* Basic message item styling */
                
                /* Special styling for chat items with forms */
                .chat__stack__item {
                    width: 100%;
                    max-width: 100% !important;
                }
                
                /* User message styling */
                .chat__stack__item--bubble {
                    align-self: flex-end;
                    background-color: #ffffff;
                    border-radius: 18px 18px 4px 18px;
                    border: 1px solid #e0e0e0;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                    max-width: 95%;
                    min-height: 40px;
                    height: auto;
                    width: auto;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    box-sizing: border-box;
                    overflow: visible;
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                    word-break: break-word;
                    white-space: normal;
                    padding: 12px 16px;
                    margin: 6px 0;
                    color: #333;
                    font-size: 16px;
                }
                
                /* AI message styling */
                
                /* Streaming message - styled like regular AI messages with reliable white background */
                .chat__stack__item--streaming {
                    align-self: flex-start;
                    background-color: white;
                    border-radius: 18px 18px 18px 4px;
                    border: 1px solid #e0e0e0;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                    border-left: 3px solid #0078ff; /* Blue accent to indicate streaming */
                    max-width: 95%;
                    min-height: 60px;
                    height: auto;
                    width: auto;
                    display: block;
                    box-sizing: border-box;
                    overflow: visible;
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                    word-break: break-word;
                    white-space: normal;
                    padding: 16px 20px 16px 20px; /* Padding for content */
                }
                
                /* Typing indicator inside streaming message */
                .typing-indicator {
                    display: inline-flex;
                    align-items: center;
                    margin-top: 8px;
                    margin-bottom: 4px;
                }
                
                /* Ensure markdown content fills container properly */
                .chat__stack__item--streaming .chat__markdown-content {
                    width: 100%;
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                    word-break: break-word;
                }
                
                /* Markdown content in AI messages */
                .chat__markdown-content {
                    line-height: 1.6;
                    font-size: 16px;
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                    word-break: break-word;
                    max-width: 100%;
                    overflow-x: hidden;
                    white-space: normal;
                }
                
                /* Styling for messages from other nodes */
                .chat__markdown-content--node-message {
                    background-color: #f5f9ff;
                    border-left: 4px solid #4a86e8;
                    padding: 12px;
                    margin: 8px 0;
                    border-radius: 8px;
                }
                
                /* Ensure content doesn't cause horizontal scrolling */
                .chat__markdown-content * {
                    max-width: 100%;
                    overflow-wrap: break-word;
                    white-space: normal;
                }
                
                /* Input container with minimal padding */
                
                
                /* Input area with full width */
                
                /* Toggle area with horizontal layout */
                .chat__toggle-area {
                    display: flex;
                    flex-direction: row;
                    gap: 8px;
                    width: 100%;
                    justify-content: center; /* Center the toggle buttons */
                    margin-top: 20px; /* Add spacing between chat and buttons */
                }
                .chat__mode-button {
                    border: 1px solid #ddd;
                    background-color: #f5f5f5;
                    border-radius: 18px;
                    padding: 8px 12px;
                    font-weight: 500;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                    white-space: nowrap;
                    flex: 1;
                }
                
                .chat__mode-button--active {
                    background-color: #0078ff;
                    color: white;
                    border-color: #0078ff;
                    font-weight: bold;
                }
                
                /* Status indicator */
                .chat__status-indicator {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 8px;
                    margin-bottom: 12px;
                    background-color: #f0f7ff;
                    border-radius: 8px;
                    color: #0066cc;
                    font-size: 14px;
                }
                
                .chat__status-spinner {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    border: 2px solid #ccc;
                    border-top-color: #0066cc;
                    margin-right: 8px;
                    animation: spin 1s linear infinite;
                }
                
                /* Suggestions */
                .chat__suggestions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 16px;
                }
                
                .chat__suggestion-button {
                    background-color: #f0f7ff;
                    border: 1px solid #d0e0ff;
                    border-radius: 16px;
                    padding: 6px 12px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    color: #0066cc;
                }
                
                .chat__suggestion-button:hover {
                    background-color: #e0f0ff;
                }
                
                .chat__suggestion-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                /* Citations */
                .chat__citations {
                    margin-top: 16px;
                    font-size: 14px;
                    color: #555;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    align-items: center;
                    border-top: 1px solid #eee;
                    padding-top: 12px;
                }
                
                .chat__citations-title {
                    font-weight: bold;
                    margin-right: 4px;
                    color: #444;
                }
                
                .chat__citation {
                    margin-right: 8px;
                }
                
                .chat__citation-link {
                    color: #0066cc;
                    text-decoration: none;
                    background-color: #f0f7ff;
                    padding: 4px 8px;
                    border-radius: 4px;
                    border: 1px solid #d0e0ff;
                }
                
                .chat__citation-link:hover {
                    text-decoration: underline;
                    background-color: #e0f0ff;
                }
                
                /* Typing indicator - adjusted to appear inside the message */
                .typing-indicator {
                    display: inline-flex;
                    align-items: center;
                    margin-top: 8px;
                    margin-bottom: 4px;
                }
                
                .typing-indicator span {
                    height: 8px;
                    width: 8px;
                    margin: 0 2px;
                    background-color: #0078ff;
                    border-radius: 50%;
                    display: inline-block;
                    animation: bounce 1.4s infinite ease-in-out both;
                    opacity: 0.7;
                }
                
                .typing-indicator span:nth-child(1) {
                    animation-delay: -0.32s;
                }
                
                .typing-indicator span:nth-child(2) {
                    animation-delay: -0.16s;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
            `}</style>
            </div>
        ) : isClosable && (
            <div className='btn chat__open_btn' onClick={() => setViewStatus('open')}>
                <div>채팅하기</div>
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M36 17.9931C36 27.9156 27.9156 36 17.9932 36C8.08448 36 2.36175e-05 27.9156 2.36175e-05 17.9931C2.36175e-05 8.08445 8.08448 0 17.9932 0C27.9156 0 36 8.08445 36 17.9931ZM11.9816 9.83949C9.45262 9.83949 8.00157 11.3044 8.00157 13.8057V21.0472C8.00157 23.5762 9.45262 25.0549 11.9816 25.0549H18.5321L21.8488 28.0261C22.2081 28.3716 22.4292 28.5097 22.7471 28.5097C23.1893 28.5097 23.4656 28.1919 23.4656 27.6945V25.0549H24.0046C26.5474 25.0549 27.9847 23.59 27.9847 21.0472V13.8057C27.9847 11.3044 26.5474 9.83949 24.0046 9.83949H11.9816Z" fill="#007AFF" />
                </svg>
            </div>
        )
    );
};

export default Chat;