import React from 'react';
import ReactMarkdown from 'react-markdown';

// Define Citation interface directly in component
interface Citation {
  text: string;
  url: string;
  title: string;
  index?: number;
}

interface StreamingMessageProps {
    content: string;
    citations?: Citation[];
    suggestions?: string[];
    onSuggestionClick: (suggestion: string) => void;
}

const StreamingMessage = ({ 
    content, 
    citations, 
    suggestions, 
    onSuggestionClick 
}: StreamingMessageProps) => {
    return (
        <div className="streaming-message">
            <div className="streaming-message__content">
                {content && (
                    <div className="streaming-message__markdown">
                        <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                )}
                
                <div className="streaming-message__typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
            
            {/* Citation sources section removed as per user request */}
            
            {/* Show suggestions */}
            {Array.isArray(suggestions) && suggestions.length > 0 && (
                <div className="streaming-message__suggestions">
                    {suggestions.map((suggestion, idx) => (
                        <button 
                            key={idx} 
                            className="streaming-message__suggestion-button"
                            onClick={() => onSuggestionClick(suggestion)}
                            disabled={true}
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}
            
            <style jsx>{`
                .streaming-message {
                    align-self: flex-start;
                    background-color: white;
                    border-radius: 18px 18px 18px 4px;
                    border: 1px solid #e0e0e0;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                    border-left: 3px solid #0078ff;
                    max-width: 95%;
                    width: auto;
                    padding: 16px 20px;
                    margin-bottom: 12px;
                    position: relative;
                }
                
                .streaming-message__content {
                    display: block;
                    width: 100%;
                    min-height: 30px;
                    position: relative;
                    background-color: white;
                }
                
                .streaming-message__markdown {
                    line-height: 1.6;
                    font-size: 16px;
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                    word-break: break-word;
                    max-width: 100%;
                    white-space: normal;
                    background-color: white;
                }
                
                .streaming-message__typing-indicator {
                    display: inline-flex;
                    align-items: center;
                    margin-top: 8px;
                    margin-bottom: 4px;
                }
                
                .streaming-message__typing-indicator span {
                    height: 8px;
                    width: 8px;
                    margin: 0 2px;
                    background-color: #0078ff;
                    border-radius: 50%;
                    display: inline-block;
                    animation: bounce 1.4s infinite ease-in-out both;
                    opacity: 0.7;
                }
                
                .streaming-message__typing-indicator span:nth-child(1) {
                    animation-delay: -0.32s;
                }
                
                .streaming-message__typing-indicator span:nth-child(2) {
                    animation-delay: -0.16s;
                }
                
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
                
                .streaming-message__citations {
                    margin-top: 16px;
                    font-size: 14px;
                    color: #555;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    align-items: center;
                    border-top: 1px solid #eee;
                    padding-top: 12px;
                    background-color: white;
                }
                
                .streaming-message__citations-title {
                    font-weight: bold;
                    margin-right: 4px;
                    color: #444;
                }
                
                .streaming-message__citation {
                    margin-right: 8px;
                }
                
                .streaming-message__citation-link {
                    color: #0066cc;
                    text-decoration: none;
                    background-color: #f0f7ff;
                    padding: 4px 8px;
                    border-radius: 4px;
                    border: 1px solid #d0e0ff;
                }
                
                .streaming-message__suggestions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 16px;
                    background-color: white;
                }
                
                .streaming-message__suggestion-button {
                    background-color: #f0f7ff;
                    border: 1px solid #d0e0ff;
                    border-radius: 16px;
                    padding: 6px 12px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    color: #0066cc;
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
};

export default StreamingMessage;