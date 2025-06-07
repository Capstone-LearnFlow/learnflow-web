"use client";
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../engine/Auth';
import { studentAPI, StudentAssignmentDetail } from '../../../services/api';

interface ResearchNavigationProps {
    className?: string;
    assignmentId: string;
}

const ResearchNavigation = ({ className, assignmentId }: ResearchNavigationProps) => {
    const router = useRouter();
    const { user } = useAuth();
    const [assignmentDetail, setAssignmentDetail] = useState<StudentAssignmentDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAssignmentDetail = async () => {
            if (!assignmentId) return;

            try {
                setIsLoading(true);
                setError(null);
                const detail = await studentAPI.getAssignmentDetail(assignmentId);
                setAssignmentDetail(detail);
            } catch (err) {
                console.error('Failed to fetch assignment detail:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssignmentDetail();
    }, [assignmentId]);

    // Display loading or error states
    const getSubjectDisplay = () => {
        if (isLoading) return '';
        if (error || !assignmentDetail) return '';
        return `${assignmentDetail.subject}(${assignmentDetail.teacherName} 선생님)`;
    };

    const getUserDisplay = () => {
        return user?.name || '';
    };

    return (
        <div className={`navigation ${className || ''}`}>
            <div className='navigation__content navigation__content--large'>
                <div className='navigation__menu_container'>
                    <div
                        className='navigation__menu navigation__menu--logo navigation__menu--inactive'
                        onClick={() => router.replace('/')}
                    >
                        LearnFlow
                    </div>
                    {!isLoading && (<>
                        <div className='navigation__menu navigation__menu--inactive'>
                            {getSubjectDisplay()}
                        </div>
                        <div className='navigation__menu'>
                            토의 준비하기
                        </div>
                    </>)}
                </div>
                <div className='navigation__menu'>
                    {getUserDisplay()}
                </div>
            </div>
        </div>
    );
};

export default ResearchNavigation;
