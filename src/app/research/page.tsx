"use client";
import { useState, FormEvent } from 'react';
import Chat from './chat';
import Create from './create';
import './page.module.css';

// Define types for JSON edit panel
interface EditableFormData {
  assertion: string;
  evidences: string[];
}

type ChatMode = 'ask' | 'create';

const Research = () => {
    // Shared state between Chat and Create components
    const [mode, setMode] = useState<ChatMode>('ask');
    const [isEditPanelOpen, setIsEditPanelOpen] = useState<boolean>(false);
    const [editData, setEditData] = useState<EditableFormData | null>(null);
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [assertion, setAssertion] = useState<string>('');
    const [evidence, setEvidence] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Handler for assertion changes in edit mode
    const handleAssertionChange = (value: string) => {
        if (editData) {
            setEditData({
                ...editData,
                assertion: value
            });
        } else {
            setAssertion(value);
        }
    };

    // Handler for evidence changes in edit mode
    const handleEvidenceItemChange = (index: number, value: string) => {
        if (editData) {
            const updatedEvidences = [...editData.evidences];
            updatedEvidences[index] = value;
            setEditData({
                ...editData,
                evidences: updatedEvidences
            });
        }
    };

    // Handler for form submission
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        // This is a stub - the actual implementation is in the Chat component
    };

    // Handler for save button in edit mode
    const handleSaveEdit = () => {
        // This is a stub - the actual implementation is in the Chat component
    };

    // Handler for cancel button in edit mode
    const handleCancelEdit = () => {
        setIsEditPanelOpen(false);
        setEditData(null);
        setEditingMessageIndex(null);
    };

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
            
            <div className="research-container">
                {(mode === 'create' || isEditPanelOpen) && (
                    <div className="create-section">
                        <Create 
                            isOpen={mode === 'create' || isEditPanelOpen}
                            editData={editData}
                            isSubmitting={isSubmitting}
                            assertion={assertion}
                            evidence={evidence}
                            onAssertionChange={handleAssertionChange}
                            onEvidenceChange={setEvidence}
                            onSubmit={handleSubmit}
                            onSaveEdit={handleSaveEdit}
                            onCancelEdit={handleCancelEdit}
                            onEvidenceItemChange={handleEvidenceItemChange}
                            editingMessageIndex={editingMessageIndex}
                        />
                    </div>
                )}
                
                <div className={`chat-section ${(mode === 'create' || isEditPanelOpen) ? 'chat-section--with-create' : ''}`}>
                    <Chat 
                        nodeId='0'
                        mode={mode}
                        setMode={setMode}
                        setIsEditPanelOpen={setIsEditPanelOpen}
                        setEditData={setEditData}
                        setEditingMessageIndex={setEditingMessageIndex}
                        isEditPanelOpen={isEditPanelOpen}
                    />
                </div>
            </div>

            <style jsx>{`
                .research-container {
                    display: flex;
                    width: 100%;
                    height: calc(100vh - 60px); /* Subtract navbar height */
                }
                
                .create-section {
                    width: 40%;
                    overflow: hidden;
                }
                
                .chat-section {
                    flex: 1;
                    width: 100%;
                    transition: width 0.3s ease;
                }
                
                .chat-section--with-create {
                    width: 60%;
                }
                
                .navigation {
                    background-color: #f8f9fa;
                    border-bottom: 1px solid #e9ecef;
                    padding: 0 16px;
                    height: 60px;
                    display: flex;
                    align-items: center;
                }
                
                .navigation__content {
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .navigation__menu_container {
                    display: flex;
                    gap: 20px;
                }
                
                .navigation__menu {
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    padding: 8px 0;
                }
                
                .navigation__menu--logo {
                    font-weight: 700;
                    color: #0078ff;
                }
                
                .navigation__menu--inactive {
                    color: #6c757d;
                }
            `}</style>
        </div>
    );
};

export default Research;