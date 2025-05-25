import Chat from './chat';
import Tree from './tree';

const Research = ({ params }: { params: { assigmentId: string } }) => {
    const { assigmentId } = params;

    return (
        <div className='Research'>
            <div className='navigation'>
                <div className='navigation__content navigation__content--large'>
                    <div className="navigation__menu_container">
                        <div className='navigation__menu navigation__menu--logo navigation__menu--inactive'>LearnFlow</div>
                        <div className='navigation__menu navigation__menu--inactive'>사회(김민지 선생님)</div>
                        <div className='navigation__menu'>토의 준비하기</div>
                    </div>
                    <div className='navigation__menu'>최민준</div>
                </div>
            </div>
            {/* <div className="section">
                <div className="header">Dashboard</div>
            </div> */}
            <Tree />
            <Chat nodeId='0' />
        </div>
    );
};

export default Research;
