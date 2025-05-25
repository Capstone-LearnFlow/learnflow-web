'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import apiServices from '../services/api';

// 사용자 타입 정의 추가
interface User {
  id: string;
  name: string;
  role?: string;
  // [key: string]: any; // 필요에 따라 추가 필드를 위한 인덱스 시그니처
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (studentId: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // 사용자 인증 상태 확인 (페이지 로드 시)
  useEffect(() => {
    const checkAuthStatus = async () => {
      // try {
      //   // 서버에서 현재 사용자 정보 조회
      //   const response = await apiServices.auth.getCurrentUser();

      //   if (response.success && response.data) {
      //     setUser(response.data);
      //     // 세션 스토리지에 사용자 정보 저장
      //     sessionStorage.setItem('user', JSON.stringify(response.data));
      //   } else {
      //     // 인증 실패 시 세션 스토리지 정보 제거
      //     setUser(null);
      //     sessionStorage.removeItem('user');
      //   }
      // } catch (error) {
      // console.error('Auth status check error:', error);
      // API 호출 실패 시 세션 스토리지에서 사용자 데이터 조회
      const storedUser = sessionStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          console.error('Failed to parse user data:', e);
          sessionStorage.removeItem('user');
        }
      }
      // } finally {
      setIsLoading(false);
      // }
    };

    checkAuthStatus();
  }, []);

  const login = async (studentId: string) => {
    try {
      setIsLoading(true);
      const response = await apiServices.auth.login(studentId);

      if (response.success && response.data) {
        setUser(response.data);
        // 세션 스토리지에 사용자 정보 저장
        sessionStorage.setItem('user', JSON.stringify(response.data));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await apiServices.auth.logout();
      setUser(null);
      sessionStorage.removeItem('user');
      router.push('/signin'); // 로그아웃 후 로그인 페이지로 리디렉션
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}