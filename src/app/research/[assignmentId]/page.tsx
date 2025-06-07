"use client";
import { useState, FormEvent, useEffect } from 'react';
import Chat from './chat';
import Tree from './tree';
import Create from './create';
import ResearchNavigation from '../components/ResearchNavigation';
import styles from './page.module.css';

// Define types for JSON edit panel
interface EditableFormData {
    assertion: string;
    evidences: string[];
}

type ChatMode = 'ask' | 'create';

const Research = ({ params }: { params: Promise<{ assignmentId: string }> }) => {
    // Shared state between Chat and Create components
    const [mode, setMode] = useState<ChatMode>('ask');
    const [isEditPanelOpen, setIsEditPanelOpen] = useState<boolean>(false);
    const [editData, setEditData] = useState<EditableFormData | null>(null);
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [assignmentId, setAssignmentId] = useState<string>('');

    // Resolve params on component mount
    useEffect(() => {
        params.then(resolvedParams => {
            setAssignmentId(resolvedParams.assignmentId);
        });
    }, [params]);
    const [assertion, setAssertion] = useState<string>('');
    const [evidence, setEvidence] = useState<string>('');
    const [isSubmitting] = useState<boolean>(false);
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
        if (!editData || editingMessageIndex === null) return;

        // Format the edited data for display
        let formattedResponse = `**주장**\n\n${editData.assertion}\n\n**근거**\n\n`;
        editData.evidences.forEach((evidence, index) => {
            formattedResponse += `${index + 1}. ${evidence}\n\n`;
        });

        // Close the edit panel
        setIsEditPanelOpen(false);
        setEditData(null);
        setEditingMessageIndex(null);
    };

    // Handler for cancel button in edit mode
    const handleCancelEdit = () => {
        setIsEditPanelOpen(false);
        setEditData(null);
        setEditingMessageIndex(null);
    };

    return (
        <div className='research'>
            <ResearchNavigation assignmentId={assignmentId} />

            <div className='research-container'>
                <div className='tree-container'>
                    <Tree assignmentId={assignmentId} />

                    {/* Create floating panel - positioned above Tree */}
                    {isEditPanelOpen && (
                        <div className={styles['create-popup']}>
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
                            />
                        </div>
                    )}
                </div>

                <div className={`${styles['']} ${(mode === 'create' || isEditPanelOpen) ? styles['chat-section--with-create'] : ''}`}>
                    <Chat
                        status='closed'
                        isClosable={true}
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