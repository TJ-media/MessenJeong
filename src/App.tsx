import { useEffect } from 'react';
import { useAuthStore } from './stores/useAuthStore';
import LoginScreen from './components/LoginScreen';
import ChatApp from './components/ChatApp';

export default function App() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const initAuth = useAuthStore((s) => s.initAuth);

  useEffect(() => {
    const unsubscribe = initAuth();
    return () => unsubscribe();
  }, [initAuth]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-screen__spinner" />
        <p>로딩 중...</p>
      </div>
    );
  }

  return user ? <ChatApp /> : <LoginScreen />;
}
