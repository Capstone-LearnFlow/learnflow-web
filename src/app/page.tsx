'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../engine/Auth';
import apiServices from '../services/api';

const Home = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      console.log('User is logged in:', user);
    } else {
      router.push('/signin');
    }
  }, [user, router]);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (user) {
        try {
          // Fetch assignments using the studentAPI service
          const studentAssignments = await apiServices.student.getAssignments();
          setAssignments(studentAssignments);

          // Log the assignments to console
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
    </div>
  );
};

export default Home;
