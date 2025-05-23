"use client";
import { useEffect, useState, useCallback, useRef, FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';

type ChatMode = 'ask' | 'create';
type ChatItemSender = "USER" | "AI";

// Define types for Gemini API responses
interface WebSource {
  uri: string;
  title: string;
}

interface GroundingChunk {
  web: WebSource;
}

interface TextSegment {
  startIndex?: number;
  endIndex?: number;
  text: string;
}

interface SegmentMapping {
  segment: TextSegment;
  citationIndices: number[];
}

interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  webSearchQueries?: string[];
}

interface Citation {
  text: string;
  url: string;
  title: string;
  index?: number;
}

// Type for inline citation references
interface InlineCitation {
  index: number;
  position: number;
}

type ChatItem = {
    sender: ChatItemSender;
    message: string;
    created_at: number;
    mode: ChatMode;
    suggestions?: string[];
    citations?: Citation[];
    hasForm?: boolean; // To identify if this message should contain a form
};

// Type for API history items
type ApiContentItem = {
    role: 'user' | 'model';
    parts: { text: string }[];
};

interface ChatProps {
    nodeId: string;
};

// Type for the assertion form response
interface AssertionResponse {
    assertion: string;
    evidences: string[];
}

const Chat = (p: ChatProps) => {
    // Initialize all state variables first
    const [mode, setMode] = useState<ChatMode>('ask');
    const [chatLog, setChatLog] = useState<ChatItem[]>([]);
    const [inputValue, setInputValue] = useState<string>('');
    const [responseStatus, setResponseStatus] = useState<'streaming' | 'success' | 'error'>('success');
    const [streamingMessage, setStreamingMessage] = useState<string>('');
    const [streamingSuggestions, setStreamingSuggestions] = useState<string[]>([]);
    const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
    const abortControllerRef = useRef<AbortController | null>(null);
    const apiHistoryRef = useRef<ApiContentItem[]>([]);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    
    // Form state
    const [activeFormMessageId, setActiveFormMessageId] = useState<number | null>(null);
    const [assertion, setAssertion] = useState<string>('');
    const [evidence, setEvidence] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Function to handle citation data without inserting inline citations
    const insertInlineCitations = (text: string, segmentMappings: SegmentMapping[]): string => {
        // No longer inserting inline citations, just return the original text
        return text;
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

    const fetchGeminiResponse = async (message: string) => {
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
            
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    history: apiHistoryRef.current.slice(0, -1) // Send all history except the last message
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
                            // Scroll happens via useEffect
                        } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                            // Handle the full raw response format
                            const candidateContent = data.candidates[0].content;
                            if (candidateContent.parts && candidateContent.parts[0] && candidateContent.parts[0].text) {
                                fullText += candidateContent.parts[0].text;
                                setStreamingMessage(fullText);
                                // Scroll happens via useEffect
                            }
                        }
                        
                        // Handle citation data (sent after all text chunks)
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
                                    .filter((chunk: GroundingChunk) => chunk.web && chunk.web.uri && chunk.web.title)
                                    .map((chunk: GroundingChunk, index: number) => ({
                                        text: `[${index + 1}]`,
                                        url: chunk.web.uri,
                                        title: chunk.web.title,
                                        index: index
                                    }));
                                setStreamingCitations(citations);
                                
                                // If we have segment mapping, insert citation references into the text
                                if (segmentMapping && segmentMapping.length > 0) {
                                    // Process the text to add inline citations
                                    fullText = insertInlineCitations(fullText, segmentMapping);
                                    setStreamingMessage(fullText);
                                    // Scroll happens via useEffect
                                }
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
            setStreamingMessage('');
            setStreamingSuggestions([]);
            setStreamingCitations([]);
            setResponseStatus('success');
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                console.log('Fetch aborted');
            } else {
                console.error('Error fetching Gemini response:', error);
                setResponseStatus('error');
            }
        } finally {
            abortControllerRef.current = null;
        }
    };

    // Function to send an assertion to OpenAI API
    const sendAssertionToOpenAI = async (assertionText: string, evidenceText: string) => {
        try {
            setIsSubmitting(true);
            setResponseStatus('streaming');

            // Combine the texts for display in chat
            const displayText = `주장: ${assertionText}\n\n근거: ${evidenceText}`;
            
            // Add user message to chat
            const newChatItem: ChatItem = {
                sender: "USER",
                message: displayText,
                created_at: Date.now(),
                mode: 'create',
            };
            setChatLog((prev) => [...prev, newChatItem]);

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

            const data: AssertionResponse = await response.json();
            
            // Format response for display
            let formattedResponse = `**주장**\n\n${data.assertion}\n\n**근거**\n\n`;
            data.evidences.forEach((evidence, index) => {
                formattedResponse += `${index + 1}. ${evidence}\n\n`;
            });

            // Add the AI response to the chat log
            const aiResponse: ChatItem = {
                sender: "AI",
                message: formattedResponse,
                created_at: Date.now(),
                mode: 'create',
            };
            
            setChatLog((prev) => [...prev, aiResponse]);
            
            // Reset form state
            setAssertion('');
            setEvidence('');
            setActiveFormMessageId(null);
            
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
            // Show error message in chat
            setChatLog((prev) => [...prev, {
                sender: "AI",
                message: "죄송합니다. 요청을 처리하는 중 오류가 발생했습니다.",
                created_at: Date.now(),
                mode: 'create',
            }]);
        } finally {
            setIsSubmitting(false);
            setResponseStatus('success');
            setStreamingMessage('');
        }
    };

    // Handle form submission
    const handleFormSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (assertion.trim() && evidence.trim() && !isSubmitting) {
            sendAssertionToOpenAI(assertion, evidence);
            // Clear active form after submission
            setActiveFormMessageId(null);
        }
    };

    // Function to add form message to chat
    const addFormMessageToChat = useCallback(() => {
        const aiFormMessage: ChatItem = {
            sender: "AI",
            message: "주장과 근거를 작성해주세요:", // "Please write your assertion and evidence:"
            created_at: Date.now(),
            mode: 'create',
            hasForm: true,
        };
        
        setChatLog((prev) => [...prev, aiFormMessage]);
        // Reset form fields
        setAssertion('');
        setEvidence('');
    }, [setChatLog, setAssertion, setEvidence]);
    
    // Add form message when mode changes to 'create'
    useEffect(() => {
        if (mode === 'create' && responseStatus === 'success') {
            addFormMessageToChat();
        }
    }, [mode, addFormMessageToChat, responseStatus]);
    const sendMessage = useCallback((text: string = inputValue) => {
        if (text.trim() === '' || responseStatus === 'streaming') return;

        // Create user message
        const newChatItem: ChatItem = {
            sender: "USER",
            message: text.trim(),
            created_at: Date.now(),
            mode: mode,
        };

        setChatLog((prev) => [...prev, newChatItem]);
        setInputValue('');

        // Only send to Gemini API in 'ask' mode
        // In 'create' mode, the form is already visible via useEffect
        if (mode === 'ask') {
            fetchGeminiResponse(text.trim());
        }
    }, [inputValue, mode, responseStatus, fetchGeminiResponse, setChatLog, setInputValue]);
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim() !== '' && responseStatus !== 'streaming') {
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
    const renderMarkdown = (message: string) => {
        return (
            <div className="chat__markdown-content">
                <ReactMarkdown>
                    {message}
                </ReactMarkdown>
            </div>
        );
    };

    return (
        <div className="card card--chat">
            <div className="chat__stack" ref={chatContainerRef}>
                {/* Existing chat log */}
                {chatLog.map((item, i) => (
                    <div key={i} className={`chat__stack__item ${item.sender === "USER" && 'chat__stack__item--bubble'}`}>
                        {item.sender === "AI" ? (
                            <>
                                {renderMarkdown(item.message)}
                                
                                {/* Show the assertion form inside AI message */}
                                {item.hasForm && (
                                    <div className="chat__inline-form">
                                        <form onSubmit={handleFormSubmit}>
                                            <div className="assertion-form__field">
                                                <label htmlFor="assertion">주장</label>
                                                <textarea 
                                                    id="assertion"
                                                    value={assertion}
                                                    onChange={(e) => setAssertion(e.target.value)}
                                                    placeholder="주장을 입력해주세요..."
                                                    rows={3}
                                                    required
                                                    disabled={isSubmitting}
                                                />
                                            </div>
                                            <div className="assertion-form__field">
                                                <label htmlFor="evidence">근거</label>
                                                <textarea 
                                                    id="evidence"
                                                    value={evidence}
                                                    onChange={(e) => setEvidence(e.target.value)}
                                                    placeholder="근거를 입력해주세요..."
                                                    rows={5}
                                                    required
                                                    disabled={isSubmitting}
                                                />
                                            </div>
                                            <div className="assertion-form__actions">
                                                <button 
                                                    type="submit" 
                                                    className="assertion-form__button assertion-form__button--submit"
                                                    disabled={isSubmitting || !assertion.trim() || !evidence.trim()}
                                                >
                                                    {isSubmitting ? '제출 중...' : '확인'}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                                
                                {/* Show citations if available */}
                                {item.citations && item.citations.length > 0 && (
                                    <div className="chat__citations">
                                        <span className="chat__citations-title">출처:</span>
                                        {item.citations.map((citation, idx) => (
                                            <span key={idx} className="chat__citation">
                                                {renderCitation(citation)}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Show suggestions */}
                                {item.suggestions && item.suggestions.length > 0 && (
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
                
                {/* Streaming message at the bottom when active */}
                {responseStatus === 'streaming' && (
                    <div className="chat__stack__item chat__stack__item--streaming">
                            {streamingMessage && renderMarkdown(streamingMessage)}
                            
                            {/* Show the typing indicator */}
                            <div className="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                            
                            {/* Show citations if available */}
                            {streamingCitations.length > 0 && (
                                <div className="chat__citations">
                                    <span className="chat__citations-title">출처:</span>
                                    {streamingCitations.map((citation, idx) => (
                                        <span key={idx} className="chat__citation">
                                            {renderCitation(citation)}
                                        </span>
                                    ))}
                                </div>
                            )}
                            
                            {/* Show suggestions if available */}
                            {streamingSuggestions.length > 0 && (
                                <div className="chat__suggestions">
                                    {streamingSuggestions.map((suggestion, idx) => (
                                        <button 
                                            key={idx} 
                                            className="chat__suggestion-button"
                                            onClick={() => handleSuggestionClick(suggestion)}
                                            disabled={true}
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            )}
                    </div>
                )}
            </div>

            <div className="chat__input-container">
                <div className="chat__input-stack">
                    {/* Mode toggle buttons positioned horizontally above input */}
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
                            disabled={responseStatus === 'streaming'}
                        >
                            생성하기
                        </button>
                    </div>
                    
                    {/* Input field with full width */}
                    <div className="chat__input-area">
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
                            onClick={() => sendMessage()}
                            disabled={responseStatus === 'streaming' || inputValue.trim() === ''}
                        ></button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                /* In-chat form styles */
                .chat__inline-form {
                    margin-top: 16px;
                    padding: 16px;
                    background-color: #f9f9f9;
                    border-radius: 12px;
                    border: 1px solid #e0e0e0;
                    width: 100%;
                    box-sizing: border-box;
                    max-width: calc(100% + 16px);
                    margin-left: -8px;
                    margin-right: -8px;
                }
                
                .assertion-form__field {
                    margin-bottom: 16px;
                }
                
                .assertion-form__field label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: bold;
                    color: #444;
                }
                
                .assertion-form__field textarea {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    resize: vertical;
                    font-family: inherit;
                    font-size: 15px;
                    background-color: #f9f9f9;
                    box-sizing: border-box;
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
                    margin-top: 24px;
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
                    background-color: #0078ff;
                    color: white;
                }
                
                .assertion-form__button--submit:hover {
                    background-color: #0065d9;
                }
                
                .assertion-form__button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                /* Vertical stack for input and toggle */
                .chat__input-stack {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    gap: 8px;
                }
                /* Main chat container */
                .card.card--chat {
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                    background-color: #f9f9f9;
                    display: flex;
                    flex-direction: column;
                    height: 90vh;
                    padding-bottom: 76px; /* Add padding for the input area */
                }
                
                /* Chat messages container with reduced padding */
                .chat__stack {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    padding: 24px 4px 16px;
                    overflow-y: auto;
                    height: 100%;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                /* Basic message item styling */
                .chat__stack__item {
                    padding: 16px 20px;
                    border-radius: 10px;
                    max-width: 95%;
                    position: relative;
                    margin-bottom: 12px;
                }
                
                /* Special styling for chat items with forms */
                .chat__stack__item:has(.chat__inline-form) {
                    max-width: 98%;
                    width: 98%;
                    padding-left: 12px;
                    padding-right: 12px;
                }
                
                /* User message styling */
                .chat__stack__item--bubble {
                    align-self: flex-end;
                    background-color: #0078ff;
                    color: white;
                    border-radius: 18px 18px 4px 18px;
                    padding: 12px 16px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                
                /* AI message styling */
                .chat__stack__item:not(.chat__stack__item--bubble) {
                    align-self: flex-start;
                    background-color: white;
                    border-radius: 18px 18px 18px 4px;
                    border: 1px solid #e0e0e0;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                }
                
                /* Streaming message */
                .chat__stack__item--streaming {
                    border-left: 3px solid #0066cc;
                    padding: 16px 20px 16px 20px;
                    background-color: #f0f7ff;
                    border-radius: 12px;
                    max-width: 95%;
                }
                
                /* Markdown content in AI messages */
                .chat__markdown-content {
                    line-height: 1.6;
                    font-size: 16px;
                }
                
                /* Input container with minimal padding */
                .chat__input-container {
                    padding: 12px 4px 16px;
                    background-color: #f9f9f9;
                    margin-top: 0;
                    width: 100%;
                    box-sizing: border-box;
                    max-width: 100%;
                }
                
                /* Input area with full width */
                .chat__input-area {
                    display: flex;
                    align-items: center;
                    border: 1px solid #ddd;
                    border-radius: 24px;
                    overflow: hidden;
                    padding: 8px 16px;
                    background-color: white;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .chat__input__text {
                    flex: 1;
                    border: none;
                    outline: none;
                    font-size: 15px;
                    padding: 8px 0;
                }
                
                .chat__input__button {
                    background-color: #e0e0e0;
                    border: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.2s;
                }
                
                .chat__input__button--active {
                    background-color: #0078ff;
                }
                
                /* Toggle area with horizontal layout */
                .chat__toggle-area {
                    display: flex;
                    flex-direction: row;
                    gap: 8px;
                    width: 100%;
                    justify-content: center; /* Center the toggle buttons */
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
                
                /* Typing indicator */
                .typing-indicator {
                    display: inline-flex;
                    align-items: center;
                    margin-top: 8px;
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
    );
}
export default Chat;