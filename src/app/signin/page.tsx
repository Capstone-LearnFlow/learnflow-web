'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineInput } from '../../components/inputs/Inputs';
import { useAuth } from '../../engine/Auth';

const Home = () => {
  const { login, isLoading, user } = useAuth();
  const [idInput, setIdInput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const router = useRouter();

  // 이미 로그인 되어있으면 메인 페이지로 리디렉션
  React.useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleLogin = async () => {
    if (!idInput.trim()) {
      setError('학번을 입력해주세요.');
      return;
    }

    try {
      setError('');
      const success = await login(idInput);

      if (success) {
        router.push('/');
      } else {
        setError('로그인에 실패했습니다. 학번을 확인해주세요.');
      }
    } catch (error) {
      setError('로그인 중 오류가 발생했습니다.');
      console.error('Login error:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className='home'>
      <div className="section">
        <div className="header">LearnFlow</div>
      </div>
      <div className='section section--large'>
        <div className='card card--signin'>
          <div className='signin__input_container'>
            <LineInput
              placeholder='학번'
              value={idInput}
              setValue={setIdInput}
              type='number'
              error={error}
              onEnter={handleKeyPress}
            />
          </div>
          <div
            className='btn btn--signin'
            onClick={handleLogin}
            style={{ opacity: isLoading ? 0.7 : 1 }}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
