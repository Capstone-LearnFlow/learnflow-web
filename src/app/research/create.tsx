"use client";
import { FormEvent } from 'react';
import styles from './create.module.css';

// Define types for JSON edit panel
interface EditableFormData {
  assertion: string;
  evidences: string[];
}

// Type for the assertion form response
interface AssertionResponse {
  assertion: string;
  evidences: string[];
}

interface CreateProps {
  isOpen: boolean;
  editData: EditableFormData | null;
  isSubmitting: boolean;
  assertion: string;
  evidence: string;
  onAssertionChange: (value: string) => void;
  onEvidenceChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEvidenceItemChange: (index: number, value: string) => void;
  editingMessageIndex: number | null;
}

const Create = ({
  isOpen,
  editData,
  isSubmitting,
  assertion,
  evidence,
  onAssertionChange,
  onEvidenceChange,
  onSubmit,
  onSaveEdit,
  onCancelEdit,
  onEvidenceItemChange,
  editingMessageIndex
}: CreateProps) => {
  
  // Render based on whether we're in edit mode or create mode
  if (!isOpen) {
    return null; // Don't render anything if not open
  }
  
  // If we have edit data, show the edit panel
  if (editData) {
    return (
      <div className={styles['create-panel']}>
        <div className={styles['create-panel__content']}>
          <div className={styles['create-panel__field']}>
            <div className={styles['create-panel__label']}>주장 {editingMessageIndex !== null && editingMessageIndex + 1}</div>
            <textarea 
              className={styles['create-panel__textarea']}
              value={editData.assertion}
              onChange={(e) => setEditData({...editData, assertion: e.target.value})}
              rows={4}
            />
          </div>
          
          {editData.evidences.map((evidence, idx) => (
            <div key={idx} className={styles['create-panel__field']}>
              <div className={styles['create-panel__label']}>근거 {idx + 1}</div>
              <textarea 
                className={styles['create-panel__textarea']}
                value={evidence}
                onChange={(e) => onEvidenceItemChange(idx, e.target.value)}
                rows={5}
              />
            </div>
          ))}
          
          <div className={styles['create-panel__actions']}>
            <button className={styles['create-panel__button']} onClick={onCancelEdit}>취소</button>
            <button className={`${styles['create-panel__button']} ${styles['create-panel__button--primary']}`} onClick={onSaveEdit}>등록하기</button>
          </div>
        </div>
      </div>
    );
  } 
  
  // Otherwise, show the form for creating a new assertion
  return (
    <div className={styles['create-panel']}>
      <div className={styles['create-panel__content']}>
        <form onSubmit={onSubmit}>
          <div className={styles['assertion-form__field']}>
            <label htmlFor="assertion">주장</label>
            <textarea 
              id="assertion"
              value={assertion}
              onChange={(e) => onAssertionChange(e.target.value)}
              placeholder="주장을 입력해주세요..."
              rows={3}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className={styles['assertion-form__field']}>
            <label htmlFor="evidence">근거</label>
            <textarea 
              id="evidence"
              value={evidence}
              onChange={(e) => onEvidenceChange(e.target.value)}
              placeholder="근거를 입력해주세요..."
              rows={5}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className={styles['assertion-form__actions']}>
            <button 
              type="submit" 
              className={`${styles['assertion-form__button']} ${styles['assertion-form__button--submit']}`}
              disabled={isSubmitting || !assertion.trim() || !evidence.trim()}
            >
              {isSubmitting ? '제출 중...' : '확인'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Create;