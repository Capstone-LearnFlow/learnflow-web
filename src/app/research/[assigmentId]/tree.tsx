type Node = {
    nodeId: string;
    type: 'argument' | 'evidence' | 'counterargument' | 'question';
    content: string;
    children: Node | Node[] | null;
}
type ArgNode = Node & {
    type: 'argument' | 'counterargument';
    children: EvidenceNode[];
};
type QuestionNode = Node & {
    type: 'question';
    children: null;
};
type EvidenceNode = Node & {
    type: 'evidence';
    children: ArgNode | QuestionNode | null;
};
type SummarizedSingleTree = {
    nodeId: string;
    type: 'subject';
    content: string;
    children: ArgNode | null;
}

const Tree = () => {
    // const { assigmentId } = params;
    const exampleTree: SummarizedSingleTree = {
        nodeId: '0',
        type: 'subject',
        content: '인공지능의 사회적 영향',
        children: {
            nodeId: '1',
            type: 'argument',
            content: '인공지능은 생산성을 향상시킨다.',
            children: [
                {
                    nodeId: '2',
                    type: 'evidence',
                    content: 'AI 기술을 활용한 기업들이 생산성을 30% 향상시켰다.',
                    children: null
                },
                {
                    nodeId: '3',
                    type: 'evidence',
                    content: 'AI는 반복적인 작업을 자동화하여 인력을 더 창의적인 작업에 집중시킨다.',
                    children: {
                        nodeId: '5',
                        type: 'counterargument',
                        content: 'AI의 자동화로 인해 일자리가 감소할 수 있다.',
                        children: [
                            {
                                nodeId: '6',
                                type: 'evidence',
                                content: '일부 산업에서는 AI 도입 후 일자리 감소가 보고되었다.',
                                children: null
                            }
                        ]
                    },
                },
                {
                    nodeId: '4',
                    type: 'evidence',
                    content: 'AI는 데이터 분석을 통해 더 나은 의사결정을 지원한다.',
                    children: null
                },
                {
                    nodeId: '7',
                    type: 'evidence',
                    content: 'AI는 고객 서비스를 개선하고, 맞춤형 경험을 제공한다.',
                    children: null
                },
                {
                    nodeId: '8',
                    type: 'evidence',
                    content: 'AI는 의료 분야에서 진단과 치료를 개선한다.',
                    children: null
                },
                {
                    nodeId: '9',
                    type: 'evidence',
                    content: 'AI는 환경 모니터링과 자원 관리에 기여한다.',
                    children: null
                },
                {
                    nodeId: '10',
                    type: 'evidence',
                    content: 'AI는 교육 분야에서 개인화된 학습 경험을 제공한다.',
                    children: null
                },
                {
                    nodeId: '11',
                    type: 'evidence',
                    content: 'AI는 교통 관리와 자율주행 기술을 발전시킨다.',
                    children: null
                },
                {
                    nodeId: '12',
                    type: 'evidence',
                    content: 'AI는 사이버 보안을 강화하고, 위협을 탐지한다.',
                    children: null
                },
                {
                    nodeId: '13',
                    type: 'evidence',
                    content: 'AI는 금융 서비스에서 사기 탐지와 리스크 관리를 개선한다.',
                    children: null
                },
                {
                    nodeId: '14',
                    type: 'evidence',
                    content: 'AI는 창의적인 작업, 예를 들어 예술과 음악 생성에 활용된다.',
                    children: null
                }
            ],
        },
    };
    const positionorigin: { x: number, y: number } = { x: 8, y: 90 };
    const nodeWidth: number = 462;
    const colGap: number = 32;
    // const rowGap: number = 12;

    return (
        <div className='tree'>
            <SubjectNode content={exampleTree.content} />
            {exampleTree.children && (
                <ArgumentNode
                    argNode={exampleTree.children}
                    position={{ x: positionorigin.x, y: positionorigin.y }}
                />
            )}
            <ArgumentNode
                argNode={{
                    nodeId: '5',
                    type: 'counterargument',
                    content: 'AI의 자동화로 인해 일자리가 감소할 수 있다.',
                    children: [
                        {
                            nodeId: '6',
                            type: 'evidence',
                            content: '일부 산업에서는 AI 도입 후 일자리 감소가 보고되었다.',
                            children: null
                        }
                    ]
                }}
                position={{ x: positionorigin.x + nodeWidth + colGap, y: positionorigin.y }}
            />
            <ArgumentNode
                argNode={{
                    nodeId: '1',
                    type: 'argument',
                    content: '인공지능은 생산성을 향상시킨다.',
                    children: [
                        {
                            nodeId: '2',
                            type: 'evidence',
                            content: 'AI 기술을 활용한 기업들이 생산성을 30% 향상시켰다.',
                            children: null
                        },
                        {
                            nodeId: '3',
                            type: 'evidence',
                            content: 'AI는 반복적인 작업을 자동화하여 인력을 더 창의적인 작업에 집중시킨다.',
                            children: {
                                nodeId: '5',
                                type: 'counterargument',
                                content: 'AI의 자동화로 인해 일자리가 감소할 수 있다.',
                                children: [
                                    {
                                        nodeId: '6',
                                        type: 'evidence',
                                        content: '일부 산업에서는 AI 도입 후 일자리 감소가 보고되었다.',
                                        children: null
                                    }
                                ]
                            },
                        },
                        {
                            nodeId: '4',
                            type: 'evidence',
                            content: 'AI는 데이터 분석을 통해 더 나은 의사결정을 지원한다.',
                            children: null
                        },
                    ],
                }}
                position={{ x: positionorigin.x + (nodeWidth + colGap) * 2, y: positionorigin.y }}
            />
        </div>
    );
};

const SubjectNode = ({ content }: { content: string }) => {
    return (
        <div className='tree__node tree__node--subject'>
            <div className='tree__node__content_container'>
                <div className='tree__node__title'>주제</div>
                <div className='tree__node__content'>{content}</div>
            </div>
        </div>
    );
}

const ArgumentNode = ({ argNode, position }: { argNode: ArgNode, position: { x: number, y: number } }) => {
    return (
        <div className={`tree__node tree__node--${argNode.type}`} style={{ left: position.x, top: position.y }}>
            <div className='tree__node__content_container'>
                <div className='tree__node__title'>{argNode.type === 'argument' ? '주장' : '반론'}</div>
                <div className='tree__node__content'>{argNode.content}</div>
            </div>
            {argNode.children && (
                <div className="tree__node__children_container">
                    {argNode.children.map((child, i) => (
                        <EvidenceNode key={child.nodeId} content={child.content} index={i + 1} />
                    ))}
                </div>
            )}
            <div className='btn tree__node__btn'></div>
        </div>
    );
}
const EvidenceNode = ({ content, index }: { content: string, index: number }) => {
    return (
        <div className='tree__node tree__node--evidence'>
            <div className='tree__node__content_container'>
                <div className='tree__node__title'>{`근거 ${index}`}</div>
                <div className='tree__node__content'>{content}</div>
            </div>
        </div>
    );
}

export default Tree;
