"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

type ChatMode = 'ask' | 'edit';
type ChatItem = {
    sender: "USER" | "AI";
    message: string;
    // referenced_node_id: null,
    // generated_node_id: number;
    created_at: number; // timestamp
    mode: ChatMode;
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
    const abortControllerRef = useRef<AbortController | null>(null);

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
            
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
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
                
                const text = decoder.decode(value, { stream: true });
                fullText += text;
                setStreamingMessage(fullText);
            }
            
            // Add the AI response to the chat log
            const aiResponse: ChatItem = {
                sender: "AI",
                message: fullText,
                created_at: Date.now(),
                mode: mode,
            };
            
            setChatLog((prev) => [aiResponse, ...prev]);
            setStreamingMessage('');
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

    const sendMessage = useCallback(() => {
        if (inputValue.trim() === '' || responseStatus === 'streaming') return;

        const newChatItem: ChatItem = {
            sender: "USER",
            message: inputValue,
            created_at: Date.now(),
            mode: mode,
        };

        setChatLog((prev) => [newChatItem, ...prev]);
        setInputValue('');

        // Send the message to the Gemini API
        fetchGeminiResponse(inputValue);
    }, [inputValue, mode, responseStatus]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim() !== '' && responseStatus !== 'streaming') {
            sendMessage();
        }
    };

    // Render markdown or plain text based on the content
    const renderMessage = (message: string) => {
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
                        {renderMessage(streamingMessage)}
                    </div>
                )}
                
                {/* Existing chat log */}
                {chatLog.map((item, i) => (
                    <div key={i} className={`chat__stack__item ${item.sender === "USER" && 'chat__stack__item--bubble'}`}>
                        {item.sender === "AI" ? renderMessage(item.message) : item.message}
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
                    onClick={sendMessage}
                    disabled={responseStatus === 'streaming' || inputValue.trim() === ''}
                ></button>
            </div>
        </div>
    );
}

export default Chat;