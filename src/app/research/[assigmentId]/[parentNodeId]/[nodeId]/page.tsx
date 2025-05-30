"use client";
import { useState, useEffect } from 'react';
import { NodeType, Node, getNodeTypeName } from '../../tree';

const NodeEditor = ({ params }: { params: Promise<{ assigmentId: string, parentNodeId: string, nodeId: string }> }) => {
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
                if (newParentNode.type === 'subject') {
                    setNode({
                        nodeId: '',
                        type: 'argument',
                        content: '',
                        children: null,
                    });
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
                            content: '인공지능은 의료 분야에서 진단과 치료에 혁신을 가져왔다.',
                            citation: ['https://example.com/ai-in-healthcare'],
                            children: null,
                        },
                        {
                            nodeId: 'e2',
                            type: 'evidence',
                            index: 2,
                            content: '인공지능은 교통 체증을 줄이고 안전성을 높이는 데 기여하고 있다.',
                            citation: ['https://example.com/ai-in-transportation'],
                            children: null,
                        },
                        {
                            nodeId: 'e3',
                            type: 'evidence',
                            index: 3,
                            content: '인공지능은 교육 분야에서 개인 맞춤형 학습을 가능하게 한다.',
                            citation: ['https://example.com/ai-in-education'],
                            children: null,
                        },
                    ],
                };
                setNode(newNode);
            }
        });
    }, [params]);

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
                                <div className='node_editor__node__content'>{node.content}</div>
                            </div>
                            <div className='node_editor__node__children_container'>
                                {node.children && node.children.map((child) => (
                                    <div key={child.nodeId} className={`node_editor__node node_editor__node--${child.type}`}>
                                        <div className='node_editor__node__content_container'>
                                            <div className='node_editor__node__title'>{`${getNodeTypeName(child.type)} ${child.index || ''}`}</div>
                                            <div className='node_editor__node__content'>{child.content}</div>
                                            {(child.citation && child.citation.length > 0) && (<>
                                                <div className='node_editor__node__title'>출처</div>
                                                {child.citation.map((cite, index) => (
                                                    <a className='node_editor__node__content' key={index} href={cite} target='_blank' rel='noopener noreferrer'>{cite}</a>
                                                ))}
                                            </>)}
                                        </div>
                                    </div>
                                ))}
                                <div className='btn node_editor__node__add_btn'></div>
                            </div>
                        </div>
                    </>)}
                </div>
                <div className='node_editor__chat'>
                </div>
            </div>
        </div >
    );
}

export default NodeEditor;
