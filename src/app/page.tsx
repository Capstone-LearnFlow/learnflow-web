'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../engine/Auth';
import apiServices, { StudentAssignment } from '../services/api';

const Home = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);

  // useEffect(() => {
  //   if (user) {
  //     console.log('User is logged in:', user);
  //   } else {
  //     router.push('/signin');
  //   }
  // }, [user, router]);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (user) {
        try {
          const studentAssignments = await apiServices.student.getAssignments();
          setAssignments(studentAssignments);

          console.log('Student assignments:', studentAssignments);
        } catch (error) {
          console.error('Error fetching assignments:', error);
        }
      }
    };

    fetchAssignments();
  }, [user]);

  return (
    <div className='home'>
      <div className='navigation'>
        <div className='navigation__content'>
          <div className='navigation__menu navigation__menu--logo'>LearnFlow</div>
          <div className='navigation__menu'>{user?.name}</div>
        </div>
      </div>
      <div className="section">
        <div className="header">Dashboard</div>
      </div>
      <div className="section section--large">
        {assignments && assignments.map((assignment) => (
          <div className='card card--assignment' key={assignment.id} onClick={() => router.push(`/research?a=${assignment.id}`)}>
            <div className='assignment__container'>
              <div className='assignment__subtitle_container'>
                <div className='assignment__subtitle assignment__subtitle--bold'>{`${assignment.subject}(${assignment.teacherName} 선생님)`}</div>
                <div className='assignment__subtitle'>{assignment.chapter}</div>
              </div>
              <div className='assignment__title'>{assignment.topic}</div>
              <div className='assignment__schedule_container'>
                <div className='assignment__schedule'>{`토의 준비하기: ~ ${new Date(assignment.phaseEndDate).toLocaleDateString()}`}</div>
              </div>
            </div>
            <div className='assignment__btn'>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.9931 36C8.08443 36 0 27.9156 0 17.9931C0 8.08445 8.08443 0 17.9931 0C27.9155 0 36 8.08445 36 17.9931C36 27.9156 27.9155 36 17.9931 36ZM26.727 17.0948L20.8399 11.0419C20.605 10.7931 20.3424 10.6687 20.0108 10.6687C19.375 10.6687 18.9052 11.1386 18.9052 11.7881C18.9052 12.0922 19.0295 12.4376 19.2921 12.6587L22.4291 15.6576L23.6591 16.8461L20.9643 16.7493H10.0745C9.41112 16.7493 8.84453 17.3159 8.84453 18.0069C8.84453 18.6841 9.41112 19.2645 10.0745 19.2645H20.9643L23.6591 19.1678L22.4291 20.3424L19.2921 23.3413C19.0295 23.5624 18.9052 23.894 18.9052 24.1981C18.9052 24.8477 19.375 25.3451 20.0108 25.3451C20.3424 25.3451 20.605 25.2069 20.8399 24.972L26.727 18.9052C27.0449 18.6011 27.1417 18.3248 27.1417 18.0069C27.1417 17.6753 27.0449 17.4127 26.727 17.0948Z" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
