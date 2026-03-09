// Background Service Worker — launchWebAuthFlow 기반 Google OAuth
// getAuthToken은 Chrome Web Store 등록 필수이므로, 개발 모드에서는 launchWebAuthFlow 사용

console.log('[MessenJeong] Background service worker 시작됨');

// manifest.json의 oauth2.client_id에서 클라이언트 ID를 불러옵니다.
const manifest = chrome.runtime.getManifest() as { oauth2?: { client_id: string } };
const CLIENT_ID = manifest.oauth2?.client_id || '';
const SCOPES = 'openid email profile';

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'messenjeong-auth') return;
    console.log('[MessenJeong] Auth port 연결됨');

    port.onMessage.addListener(async (message) => {
        console.log('[MessenJeong] 메시지 수신:', message.type);

        if (message.type === 'GET_AUTH_TOKEN') {
            try {
                const redirectUrl = chrome.identity.getRedirectURL();
                console.log('[MessenJeong] Redirect URL:', redirectUrl);

                const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
                authUrl.searchParams.set('client_id', CLIENT_ID);
                authUrl.searchParams.set('response_type', 'token');
                authUrl.searchParams.set('redirect_uri', redirectUrl);
                authUrl.searchParams.set('scope', SCOPES);

                console.log('[MessenJeong] launchWebAuthFlow 호출 중...');
                const responseUrl = await chrome.identity.launchWebAuthFlow({
                    url: authUrl.toString(),
                    interactive: true,
                });

                if (!responseUrl) {
                    throw new Error('인증 응답을 받지 못했습니다.');
                }

                // 응답 URL의 hash fragment에서 access_token 추출
                const hashParams = new URLSearchParams(new URL(responseUrl).hash.substring(1));
                const token = hashParams.get('access_token');

                if (token) {
                    console.log('[MessenJeong] access_token 획득 성공');
                    port.postMessage({ success: true, token });
                } else {
                    const error = hashParams.get('error') || '알 수 없는 오류';
                    throw new Error(`Access token을 받지 못했습니다: ${error}`);
                }
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : String(error);
                console.error('[MessenJeong] 인증 실패:', msg);
                port.postMessage({ success: false, error: msg });
            }
        }

        if (message.type === 'REMOVE_AUTH_TOKEN') {
            // launchWebAuthFlow는 별도 토큰 캐시가 없으므로 바로 성공 반환
            // Firebase 로그아웃은 content script 측에서 처리
            port.postMessage({ success: true });
        }
    });
});
