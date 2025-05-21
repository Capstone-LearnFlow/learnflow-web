"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

type ChatMode = 'ask' | 'edit';
type ChatItemSender = "USER" | "AI";

// Define types for Gemini API responses
interface WebSource {
  uri: string;
  title: string;
}

interface GroundingChunk {
  web: WebSource;
}

interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  webSearchQueries?: string[];
}

interface Citation {
  text: string;
  url: string;
  title: string;
}

type ChatItem = {
    sender: ChatItemSender;
    message: string;
    created_at: number;
    mode: ChatMode;
    suggestions?: string[];
    citations?: Citation[];
};

// Type for API history items
type ApiContentItem = {
    role: 'user' | 'model';
    parts: { text: string }[];
};

interface ChatProps {
    nodeId: string;
};

const Chat = (p: ChatProps) => {
    const [mode, setMode] = useState<ChatMode>('ask');
    const [chatLog, setChatLog] = useState<ChatItem[]>([]);
    const [inputValue, setInputValue] = useState<string>('');
    const [responseStatus, setResponseStatus] = useState<'streaming' | 'success' | 'error'>('success');
    const [streamingMessage, setStreamingMessage] = useState<string>('');
    const [streamingSuggestions, setStreamingSuggestions] = useState<string[]>([]);
    const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
    const abortControllerRef = useRef<AbortController | null>(null);
    const apiHistoryRef = useRef<ApiContentItem[]>([]);

    useEffect(() => {
        // Clean up any ongoing fetch request when component unmounts
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

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
                        
                        // Handle regular text chunks
                        if (data.text) {
                            fullText += data.text;
                            setStreamingMessage(fullText);
                        }
                        
                        // Handle citation data (sent after all text chunks)
                        if (data.type === 'citations' && data.groundingMetadata) {
                            const { groundingMetadata } = data;
                            
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
                                        title: chunk.web.title
                                    }));
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
            
            setChatLog((prev) => [aiResponse, ...prev]);
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

    const sendMessage = useCallback((text: string = inputValue) => {
        if (text.trim() === '' || responseStatus === 'streaming') return;

        const newChatItem: ChatItem = {
            sender: "USER",
            message: text.trim(),
            created_at: Date.now(),
            mode: mode,
        };

        setChatLog((prev) => [newChatItem, ...prev]);
        setInputValue('');

        // Send the message to the Gemini API
        fetchGeminiResponse(text.trim());
    }, [inputValue, mode, responseStatus]);

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

    // Render markdown content
    const renderMarkdown = (message: string) => {
        return (
            <ReactMarkdown>
                {message}
            </ReactMarkdown>
        );
    };

    return (
        <div className="card card--chat">
            <div className="chat__stack">
                {/* Streaming message at the top when active */}
                {responseStatus === 'streaming' && streamingMessage && (
                    <div className="chat__stack__item">
                        {renderMarkdown(streamingMessage)}
                        
                        {/* Show the placeholder while streaming */}
                        {streamingMessage.length > 0 && (
                            <span className="cursor-blink">_</span>
                        )}
                        
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
                
                {/* Existing chat log */}
                {chatLog.map((item, i) => (
                    <div key={i} className={`chat__stack__item ${item.sender === "USER" && 'chat__stack__item--bubble'}`}>
                        {item.sender === "AI" ? (
                            <>
                                {renderMarkdown(item.message)}
                                
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
            </div>
            <div className="chat__input">
                <input 
                    type="text" 
                    className="chat__input__text" 
                    placeholder="질문하기..." 
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

            <style jsx>{`
                .chat__suggestions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 16px;
                }
                
                .chat__suggestion-button {
                    background-color: #f0f0f0;
                    border: 1px solid #ddd;
                    border-radius: 16px;
                    padding: 6px 12px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .chat__suggestion-button:hover {
                    background-color: #e0e0e0;
                }
                
                .chat__suggestion-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .chat__citations {
                    margin-top: 16px;
                    font-size: 14px;
                    color: #555;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    align-items: center;
                }
                
                .chat__citations-title {
                    font-weight: bold;
                    margin-right: 4px;
                }
                
                .chat__citation {
                    margin-right: 8px;
                }
                
                .chat__citation-link {
                    color: #0066cc;
                    text-decoration: none;
                    background-color: #f0f0f0;
                    padding: 2px 6px;
                    border-radius: 4px;
                }
                
                .chat__citation-link:hover {
                    text-decoration: underline;
                    background-color: #e6e6e6;
                }
                
                .cursor-blink {
                    animation: blink 1s infinite;
                    font-weight: bold;
                }
                
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
            `}</style>
        </div>
    );
}

export default Chat;