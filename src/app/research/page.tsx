"use client";
import { useState, FormEvent } from 'react';
import Chat from './chat';
import Create from './create';
import styles from './page.module.css';

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
        <div className={styles.Research}>
            <div className={styles.navigation}>
                <div className={`${styles['navigation__content']} ${styles['navigation__content--large']}`}>
                    <div className={styles['navigation__menu_container']}>
                        <div className={`${styles['navigation__menu']} ${styles['navigation__menu--logo']} ${styles['navigation__menu--inactive']}`}>LearnFlow</div>
                        <div className={`${styles['navigation__menu']} ${styles['navigation__menu--inactive']}`}>사회(김민지 선생님)</div>
                        <div className={styles['navigation__menu']}>토의 준비하기</div>
                    </div>
                    <div className={styles['navigation__menu']}>최민준</div>
                </div>
            </div>
            
            <div className={styles['research-container']}>
                {(mode === 'create' || isEditPanelOpen) && (
                    <div className={styles['create-section']}>
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
                
                <div className={`${styles['chat-section']} ${(mode === 'create' || isEditPanelOpen) ? styles['chat-section--with-create'] : ''}`}>
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

        </div>
    );
};

export default Research;