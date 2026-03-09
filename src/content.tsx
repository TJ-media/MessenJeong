import { createRoot } from 'react-dom/client';
import App from './App';
import cssContent from './index.css?inline';

// Content Script 엔트리포인트 — Shadow DOM으로 격리
const hostEl = document.createElement('div');
hostEl.id = 'messenjeong-root';
document.body.appendChild(hostEl);

const shadow = hostEl.attachShadow({ mode: 'open' });

// 스타일을 Shadow DOM에 주입
const style = document.createElement('style');
style.textContent = cssContent;
shadow.appendChild(style);

// React 렌더 타겟
const appRoot = document.createElement('div');
appRoot.id = 'messenjeong-app';
shadow.appendChild(appRoot);

// StrictMode 제거 — Content Script에서 useEffect 이중 실행으로 인한 리스너 중복 방지
createRoot(appRoot).render(<App />);
