"use client";
import { useEffect, useState, useCallback } from 'react';

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

    useEffect(() => {
        // setInitialChatLog();
        // setMode('ask');
    }, [p.nodeId]);

    const sendMessage = useCallback(() => {
        if (inputValue.trim() === '') return;

        const newChatItem: ChatItem = {
            sender: "USER",
            message: inputValue,
            created_at: Date.now(),
            mode: mode,
        };

        setChatLog((prev) => [newChatItem, ...prev]);
        setInputValue('');

        // Simulate AI response
        setResponseStatus('streaming');
        setTimeout(() => {
            const aiResponse: ChatItem = {
                sender: "AI",
                message: "대한민국의 연령별 인구 변화에 대한 정보는 다음과 같은 곳에서 찾을 수 있습니다",
                created_at: Date.now(),
                mode: mode,
            };
            setChatLog((prev) => [aiResponse, ...prev]);
            setResponseStatus('success');
        }, 1000);
    }, [inputValue, mode]);

    return (
        <div className="card card--chat">
            <div className="chat__stack">
                {/* <div className="chat__stack__item">
                    대한민국의 연령별 인구 변화에 대한 정보는 다음과 같은 곳에서 찾을 수 있습니다:
                    <br /><br />
                    <br />1. 통계청 국가통계포털(KOSIS) - 한국의 공식 통계 사이트로 연령별, 성별 인구 통계와 인구 피라미드 등 자세한 인구 데이터를 제공합니다.
                    <br />2. 행정안전부 주민등록 인구통계 - 주민등록 기준 인구 데이터를 제공합니다.
                    <br />3. 한국 보건사회연구원 - 인구 관련 연구 보고서와 분석 자료를 발행합니다.
                    <br />4. e-나라지표 - 국가 주요 지표를 제공하며 인구 관련 추이도 확인할 수 있습니다.
                    <br /><br />
                    <br />특히 통계청 국가통계포털(KOSIS)은 가장 포괄적이고 신뢰할 수 있는 정보를 제공하므로 연령별 인구 변화에 대한 자세한 데이터를 찾는 데 가장 적합합니다.
                    <br /><br />
                    <br />특정 연령대나 시기의 인구 데이터가 필요하시다면 좀 더 자세히 알려주시겠어요?
                </div>
                <div className="chat__stack__item chat__stack__item--bubble">
                    대한민국의 최근 10년간 연령별 인구 변화를 알려줘
                </div> */}
                {chatLog.map((item, i) => (
                    <div key={i} className={`chat__stack__item ${item.sender === "USER" && 'chat__stack__item--bubble'}`}>
                        {item.message}
                    </div>
                ))}
            </div>
            <div className="chat__input">
                <input type="text" className="chat__input__text" placeholder="질문하기..." value={inputValue || ''} onChange={(e) => setInputValue(e.target.value)} />
                <button className={`chat__input__button ${(inputValue && responseStatus !== 'streaming') && 'chat__input__button--active'}`} onClick={sendMessage}></button>
            </div>
        </div>
    );
}

export default Chat;