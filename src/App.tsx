import { useEffect } from 'react';
import { useAuthStore } from './stores/useAuthStore';
import { useSettingsStore } from './stores/useSettingsStore';
import LoginScreen from './components/LoginScreen';
import ChatApp from './components/ChatApp';

export default function App() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const initAuth = useAuthStore((s) => s.initAuth);
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const unsubscribe = initAuth();
    return () => unsubscribe();
  }, [initAuth]);

  // Shadow DOM host에 테마 클래스 적용
  useEffect(() => {
    const shadowHost = document.getElementById('messenjeong-root');
    if (shadowHost) {
      shadowHost.classList.remove('theme-dark', 'theme-light');
      shadowHost.classList.add(`theme-${theme}`);
    }
  }, [theme]);

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
