"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { NodeType, Node, getNodeTypeName } from '../../tree';

const NodeEditor = ({ params }: { params: Promise<{ assigmentId: string, parentNodeId: string, nodeId: string }> }) => {
    const router = useRouter();
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

    // Resolve params on component mount
    useEffect(() => {
        params.then(resolvedParams => {
            console.log('Assignment ID:', resolvedParams.assigmentId);
            console.log('Parent Node ID:', resolvedParams.parentNodeId);
            console.log('Node ID:', resolvedParams.nodeId); // 새 노드 추가인 경우 'new'

            // API 호출 등을 통해 parentNode와 node 정보를 가져오기

            // 예시로 parentNode와 node를 설정
            const newParentNode: Node = {
                nodeId: resolvedParams.parentNodeId,
                type: 'subject',
                content: '인공지능의 사회적 영향',
                children: null,
            };
            setParentNode(newParentNode);

            if (resolvedParams.nodeId === 'new') {
                if (newParentNode.type === 'subject' || newParentNode.type === 'evidence') {
                    setNode({
                        nodeId: '',
                        type: 'argument',
                        content: '',
                        children: null,
                    });
                } else {
                    router.back();
                    return;
                }
            } else {
                // 여기서 API를 통해 node 정보를 가져와야 함
                const newNode: Node = {
                    nodeId: resolvedParams.nodeId,
                    type: 'argument',
                    content: '인공지능은 사회에 긍정적인 영향을 미친다.',
                    children: [
                        {
                            nodeId: 'e1',
                            type: 'evidence',
                            index: 1,
                            content: '인공지능은 의료 분야에서 진단과 치료에 혁신을 가져왔다. 조사에 따르면, 인공지능은 조기 진단과 개인 맞춤형 치료를 가능하게 하여 환자의 생존율을 높이고 있다. 이러한 기술은 특히 암 치료와 같은 복잡한 질병 관리에 큰 도움이 되고 있다. 또한 인공지능은 의료 데이터 분석을 통해 질병 예측과 예방에도 기여하고 있다. 이러한 혁신은 의료 비용을 절감하고, 환자 치료의 질을 향상시키는 데 중요한 역할을 하고 있다.',
                            citation: ['https://example.com/ai-in-healthcare'],
                            children: null,
                        },
                        {
                            nodeId: 'e2',
                            type: 'evidence',
                            index: 2,
                            content: '인공지능은 교통 체증을 줄이고 안전성을 높이는 데 기여하고 있다. 스마트 교통 시스템과 자율주행차 기술은 교통 흐름을 최적화하고, 사고를 줄이는 데 중요한 역할을 하고 있다. 예를 들어, 인공지능 기반의 교통 신호 제어 시스템은 실시간 데이터를 분석하여 신호를 조정함으로써 교통 체증을 최소화하고 있다. 또한, 자율주행차는 인간의 실수를 줄여 도로 안전성을 높이고 있다. 이러한 기술들은 도시의 교통 문제를 해결하는 데 큰 잠재력을 가지고 있다.',
                            citation: ['https://example.com/ai-in-transportation'],
                            children: null,
                        },
                        {
                            nodeId: 'e3',
                            type: 'evidence',
                            index: 3,
                            content: '인공지능은 교육 분야에서 개인 맞춤형 학습을 가능하게 한다. AI 기반의 학습 플랫폼은 학생의 학습 스타일과 속도에 맞춰 커리큘럼을 조정할 수 있다. 예를 들어, 인공지능은 학생의 이해도를 분석하여 추가 학습 자료를 제공하거나, 어려운 개념을 다시 설명하는 등의 맞춤형 지원을 제공한다. 이러한 기술은 학생들이 자신의 속도로 학습할 수 있게 하여 교육의 질을 향상시키고, 학습 격차를 줄이는 데 기여하고 있다.',
                            citation: ['https://example.com/ai-in-education'],
                            children: null,
                        },
                        {
                            nodeId: 'e4',
                            type: 'evidence',
                            index: 4,
                            content: '인공지능은 환경 보호와 자원 관리에 도움을 준다. AI 기술은 에너지 소비를 최적화하고, 자원 낭비를 줄이는 데 기여한다. 예를 들어, 인공지능은 스마트 그리드 시스템을 통해 전력 소비를 실시간으로 모니터링하고 조절함으로써 에너지 효율성을 높인다. 또한, AI는 환경 데이터를 분석하여 기후 변화 예측과 자연 재해 대응에 도움을 준다. 이러한 기술들은 지속 가능한 발전을 위한 중요한 도구로 자리 잡고 있다.',
                            citation: ['https://example.com/ai-in-environment'],
                            children: null,
                        },
                    ],
                };
                setNode(newNode);
            }
        });
    }, [params]);

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

    const handleAddChildNode = useCallback(() => {
        setNode(prevNode => {
            const currentChildren = prevNode.children || [];
            const nextIndex = currentChildren.length + 1;
            const newChildId = `e${nextIndex}`;

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
                        < div className={`node_editor__node node_editor__node--${parentNode.type}`}>
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
                                <textarea
                                    className='node_editor__node__content'
                                    rows={1}
                                    placeholder='내용을 입력하세요'
                                    value={node.content}
                                    onChange={handleNodeContentChange}
                                ></textarea>
                            </div>
                            <div className='node_editor__node__children_container'>
                                {node.children && node.children.map((child) => (
                                    <div key={child.nodeId} className={`node_editor__node node_editor__node--${child.type}`}>
                                        <div className='node_editor__node__content_container'>
                                            <div className='node_editor__node__title'>{`${getNodeTypeName(child.type)} ${child.index || ''}`}</div>
                                            <textarea
                                                className='node_editor__node__content'
                                                data-node-id={child.nodeId}
                                                rows={1}
                                                placeholder='내용을 입력하세요'
                                                value={child.content}
                                                onChange={(e) => handleChildContentChange(child.nodeId, e.target.value, e)}
                                            ></textarea>
                                            {(child.citation && child.citation.length > 0) && (<>
                                                <div className='node_editor__node__title'>출처</div>
                                                {child.citation.map((cite, index) => (
                                                    <a className='node_editor__node__content' key={index} href={cite} target='_blank' rel='noopener noreferrer'>{cite}</a>
                                                ))}
                                            </>)}
                                        </div>
                                    </div>
                                ))}
                                {node.type === 'argument' && (
                                    <div className='btn node_editor__node__add_btn' onClick={handleAddChildNode}></div>
                                )}
                            </div>
                        </div>
                    </>)}
                </div>
                <div className='node_editor__chat'>
                    {/* 채팅 */}
                </div>
            </div>
        </div >
    );
}

export default NodeEditor;
