// app/_layout.tsx
import { nanoid } from "nanoid/non-secure";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Linking,
  NativeModules,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { WebView } from "react-native-webview";
import FirebaseNotificationHandler from "../hooks/firebaseNotificationHandler";
import { getQuizbellsAuth, setQuizbellsAuth } from "../utils/utils";

// 안전한 네이티브 모듈 접근
const getWebViewAdsModule = () => {
  try {
    console.log("=== 네이티브 모듈 디버깅 ===");
    console.log("전체 NativeModules 키들:", Object.keys(NativeModules));
    console.log(
      "WebViewAdsModule 존재 여부:",
      !!NativeModules.WebViewAdsModule
    );

    if (NativeModules.WebViewAdsModule) {
      console.log("✅ WebViewAdsModule 찾음!");
      console.log(
        "사용 가능한 메서드들:",
        Object.keys(NativeModules.WebViewAdsModule)
      );
    } else {
      console.log("❌ WebViewAdsModule 없음");
    }
    console.log("========================");

    return NativeModules.WebViewAdsModule;
  } catch (error) {
    console.warn("WebViewAds 모듈을 찾을 수 없습니다:", error);
    return null;
  }
};

const BASE_WEBVIEW_URL =
  "https://google.github.io/webview-ads/test/#api-for-ads-tests";
// const BASE_WEBVIEW_URL = "https://coinpan.com";
// const BASE_WEBVIEW_URL = "https://quizbells.com";
// const BASE_WEBVIEW_URL = "https://choyoungjang.tistory.com/3";
// const BASE_WEBVIEW_URL = "http://192.168.219.101:3000";

const handleRegistrationError = (errorMessage: string) => {
  alert(errorMessage);
  throw new Error(errorMessage);
};

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const isPushInitializedRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [webviewUrl, setWebviewUrl] = useState(BASE_WEBVIEW_URL);
  const [isWebViewRegistered, setIsWebViewRegistered] = useState(false);
  const lastUrlRef = useRef<string | null>(null);

  // FirebaseNotificationHandler 인스턴스를 useRef로 관리
  const notificationHandlerRef = useRef<FirebaseNotificationHandler | null>(
    null
  );

  // WebView 로드 완료 후 처리
  const handleWebViewLoad = async () => {
    console.log("handleWebViewLoad111");

    // localStorage에 인증 정보 저장
    const quizbellsAuth = await getQuizbellsAuth();
    if (quizbellsAuth && webViewRef.current) {
      const jsCode = `localStorage.setItem("quizbells-auth", '${JSON.stringify(
        quizbellsAuth
      )}'); true;`;
      webViewRef.current.injectJavaScript(jsCode);
    }

    // 플랫폼별 WebView 등록
    if (!isWebViewRegistered) {
      try {
        console.log(
          `${Platform.OS} WebView loaded, attempting registration...`
        );

        const WebViewAds = getWebViewAdsModule();
        if (!WebViewAds) {
          console.error(`WebViewAds module not available on ${Platform.OS}`);

          // iOS에서 모듈이 없으면 JavaScript 레벨에서 처리
          if (Platform.OS === "ios" && webViewRef.current) {
            console.log("iOS에서 JavaScript 레벨 광고 최적화 시도...");
            const optimizationScript = `
            (function() {
              // Google Ads 최적화
              window.GADWebViewAdsOptimized = true;
              console.log('✅ iOS WebView 광고 최적화 완료');
              
              // Google Ads API 확인
              const checkGoogleAds = setInterval(() => {
                if (typeof googletag !== 'undefined' || typeof google !== 'undefined') {
                  console.log('🎯 Google Ads API 감지됨');
                  clearInterval(checkGoogleAds);
                }
              }, 1000);
              
              return true;
            })();
          `;
            webViewRef.current.injectJavaScript(optimizationScript);
          }
          return;
        }

        // 네이티브 모듈을 통한 등록
        const delay = Platform.OS === "ios" ? 2000 : 500;

        setTimeout(async () => {
          try {
            console.log(`${Platform.OS} WebView 등록 시도 중...`);
            const result = await WebViewAds.registerAllWebViews();
            console.log(`${Platform.OS} Registration result:`, result);
            setIsWebViewRegistered(true);

            console.log(webViewRef.current);
            // 등록 성공 후 확인
            if (webViewRef.current) {
              const confirmScript = `
              console.log('✅ WebView가 GMA SDK와 연결되었습니다');
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'webview-registered',
                platform: '${Platform.OS}',
                success: true
              }));
            `;
              webViewRef.current.injectJavaScript(confirmScript);

              // 🔥 등록 완료 후 5초 뒤 새로고침으로 광고 연결 확인
              setTimeout(() => {
                console.log("📄 WebView 등록 완료 후 새로고침 실행...");
                if (webViewRef.current) {
                  webViewRef.current.reload();
                }
              }, 5000);
            }
          } catch (registrationError) {
            console.error(
              `${Platform.OS} WebView registration error:`,
              registrationError
            );

            // 실패 시 대체 방법
            if (Platform.OS === "ios" && webViewRef.current) {
              const fallbackScript = `
              console.log('⚠️ 네이티브 등록 실패, JavaScript 최적화로 대체');
              window.GADWebViewFallback = true;
            `;
              webViewRef.current.injectJavaScript(fallbackScript);
            }
          }
        }, delay);
      } catch (error) {
        console.error(`${Platform.OS} WebView registration error:`, error);
      }
    }
  };

  // 🔥 새로고침 및 광고 연결 상태 확인 함수 추가
  const checkAndRefreshWebView = useCallback(() => {
    if (webViewRef.current) {
      console.log("🔄 WebView 광고 연결 상태 확인 중...");

      // 광고 연결 상태 확인용 JavaScript 주입
      const checkConnectionScript = `
      (function() {
        console.log('=== WebView 광고 연결 상태 확인 ===');
        
        // GMA SDK 연결 확인
        const isGMAConnected = window.GADWebViewAdsOptimized || window.GADWebViewFallback;
        console.log('GMA SDK 연결 상태:', isGMAConnected ? '✅ 연결됨' : '❌ 연결 안됨');
        
        // Google Ads API 확인
        const hasGoogleAds = typeof googletag !== 'undefined' || typeof google !== 'undefined';
        console.log('Google Ads API 상태:', hasGoogleAds ? '✅ 사용 가능' : '❌ 사용 불가');
        
        // 현재 페이지에 광고 요소 확인
        const adElements = document.querySelectorAll('[data-ad-client], [data-ad-slot], .adsbygoogle, ins.adsbygoogle');
        console.log('페이지 광고 요소 개수:', adElements.length);
        
        // 결과를 React Native로 전송
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ad-connection-check',
          gmaConnected: isGMAConnected,
          googleAdsAPI: hasGoogleAds,
          adElementsCount: adElements.length,
          url: window.location.href
        }));
        
        console.log('================================');
        return true;
      })();
    `;

      webViewRef.current.injectJavaScript(checkConnectionScript);
    }
  }, []);

  // 🔥 수동 새로고침 함수 (디버깅용)
  const manualRefreshWebView = useCallback(() => {
    console.log("🔄 수동 WebView 새로고침 실행...");
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  }, []);

  // handleMessage 함수 수정
  const handleMessage = (event: any) => {
    const message = event.nativeEvent.data;
    console.log("WebView Message: ", message);

    try {
      const parsed = JSON.parse(message);

      if (parsed.type === "webview-registered") {
        console.log("🎉 WebView 등록 완료:", parsed);
      } else if (parsed.type === "ad-connection-check") {
        console.log("📊 광고 연결 상태:", parsed);

        // 연결 상태에 따른 자동 처리
        if (!parsed.gmaConnected && !parsed.googleAdsAPI) {
          console.log("⚠️ 광고 연결 문제 감지, 10초 후 재시도...");
          setTimeout(() => {
            manualRefreshWebView();
          }, 10000);
        }
      } else if (parsed.type === "ad-loaded") {
        console.log("📢 광고 로드됨:", parsed.src);
      } else if (parsed.type === "console") {
        console.log("📱 WebView Console:", parsed.message);
      }
    } catch (e) {
      // JSON이 아닌 일반 메시지 처리
      if (message.includes("Google Ads") || message.includes("광고")) {
        console.log("📢 광고 관련 메시지:", message);
      }
    }
  };

  // 🔥 주기적 광고 연결 확인 (선택적)
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (isWebViewRegistered) {
        checkAndRefreshWebView();
      }
    }, 30000); // 30초마다 확인

    return () => clearInterval(intervalId);
  }, [isWebViewRegistered, checkAndRefreshWebView]);

  const reloadWebView = useCallback(
    (link: string) => {
      console.log("기존 URL:", webviewUrl);
      console.log("새로운 URL:", link);
      setWebviewUrl(link);
    },
    [webviewUrl]
  );

  useEffect(() => {
    const initPush = async () => {
      console.log("isPushInitializedRef.current", isPushInitializedRef.current);
      if (isPushInitializedRef.current) {
        console.log("🚫 이미 푸시 초기화됨");
        return;
      }

      console.log("👉 푸시 초기화 시작");

      try {
        const handler = new FirebaseNotificationHandler(reloadWebView);
        notificationHandlerRef.current = handler;

        const result = await handler.requestUserPermission();
        console.log("권한 요청 결과:", result);

        if (!result) return;

        const token = await handler.getFCMToken();
        console.log(`📱 푸시 토큰: ${token}`);

        // 기존 토큰과 비교
        const stored = await getQuizbellsAuth();
        if (stored?.fcmToken === token) {
          console.log("✅ 기존 토큰 유지");
          return;
        }

        const quizbellsInfo = {
          userId: nanoid(12),
          joinType: Platform.OS,
          fcmToken: token,
        };

        const res = await fetch(`${BASE_WEBVIEW_URL}/api/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quizbellsInfo),
        });

        if (!res.ok) console.warn("❌ 서버 등록 실패:", res.status);
        else console.log("✅ 서버 등록 완료");

        await setQuizbellsAuth(quizbellsInfo);
        console.log("📦 로컬 저장 완료");

        // 테스트 알림
        setTimeout(() => handler.showTestNotification(), 5000);
        // URL 전환
        isPushInitializedRef.current = true;
      } catch (e) {
        handleRegistrationError(`${e}`);
      } finally {
        setWebviewUrl(`${BASE_WEBVIEW_URL}`);
      }
    };

    initPush();

    return () => {
      notificationHandlerRef.current?.cleanup();
      notificationHandlerRef.current = null;
      isPushInitializedRef.current = false;
    };
  }, []);

  // reloadWebView 콜백이 변경될 때마다 핸들러 업데이트
  useEffect(() => {
    if (notificationHandlerRef.current) {
      notificationHandlerRef.current.setWebviewReloadCallback(reloadWebView);
    }
  }, [reloadWebView]);

  // 안드로이드 뒤로가기 버튼 처리
  useEffect(() => {
    console.log("✅ 뒤로가기 버튼 제어 로직 추가");
    const backAction = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      } else {
        BackHandler.exitApp();
        return true;
      }
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, [canGoBack]);

  const handleNavigationStateChange = (navState: any) => {
    if (navState.url === lastUrlRef.current) return; // 중복 방지

    lastUrlRef.current = navState.url;
    setCanGoBack(navState.canGoBack);
    console.log("navState", navState);

    // 💡 중요: 웹뷰의 실제 URL과 state 동기화
    if (navState.url !== webviewUrl) {
      setWebviewUrl(navState.url);
    }

    if (navState.url.includes("apps.apple.com")) {
      Linking.openURL(navState.url); // Safari 또는 쿠팡 앱으로
    }
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.log("WebView 오류:", nativeEvent);

    // 네트워크 오류 시 자동 새로고침
    if (nativeEvent.code === -1005) {
      if (webViewRef.current) {
        webViewRef.current.reload();
      }
    }
  };

  const handleShouldStartLoadWithRequest = (request: any): boolean => {
    const { url } = request;

    // Android Play Store 링크
    if (url.includes("play.google.com/store/apps/details")) {
      const packageMatch = url.match(/id=([^&\/#]+)/);
      if (packageMatch) {
        const packageName = packageMatch[1];

        // 1. Intent URL로 앱 직접 실행 시도
        const intentUrl = `intent://app#Intent;package=${packageName};end`;
        console.log("intentUrl", intentUrl);
        Linking.openURL(intentUrl).catch(() => {
          // 2. Market URL로 시도
          const marketUrl = `market://details?id=${packageName}`;
          console.log("marketUrl", marketUrl);
          Linking.openURL(marketUrl).catch(() => {
            // 3. 웹 Play Store로 fallback
            console.log("url", url);
            Linking.openURL(url);
          });
        });
        console.log("url", url);
        Linking.openURL(url);
      } else {
        Linking.openURL(url);
      }
      return false;
    }

    // iOS App Store 링크는 그대로 처리
    if (url.includes("apps.apple.com")) {
      Linking.openURL(url);
      return false;
    }

    return true;
  };

  useEffect(() => {
    console.log("webviewUrl이 변경됨:", webviewUrl);
  }, [webviewUrl]);

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ uri: webviewUrl }}
          style={{
            marginTop: insets.top,
            marginBottom: insets.bottom,
          }}
          // iOS 광고 최적화 설정
          {...(Platform.OS === "ios" && {
            thirdPartyCookiesEnabled: true,
            sharedCookiesEnabled: true,
            allowsInlineMediaPlaybook: true,
            cacheEnabled: true,
            incognito: false,
            bounces: false,
            scrollEnabled: true,
            automaticallyAdjustContentInsets: false,
            allowsBackForwardNavigationGestures: false,
            limitsNavigationsToAppBoundDomains: false,
            textInteractionEnabled: true,
          })}
          mediaPlaybackRequiresUserAction={false}
          thirdPartyCookiesEnabled={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={false}
          onLoadEnd={handleWebViewLoad}
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          onMessage={handleMessage}
          onError={handleError}
          // 광고 최적화를 위한 User Agent 설정
          userAgent={
            Platform.OS === "ios"
              ? "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
              : undefined
          }
          injectedJavaScript={`
            (function() {
              // 콘솔 로그 캡처
              const originalConsoleLog = console.log;
              console.log = function(message) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'console',
                  message: message
                }));
                originalConsoleLog(message);
              };
              
              // 광고 로드 감지
              const originalCreateElement = document.createElement;
              document.createElement = function(tagName) {
                const element = originalCreateElement.call(document, tagName);
                if (tagName.toLowerCase() === 'script' || tagName.toLowerCase() === 'iframe') {
                  element.addEventListener('load', function() {
                    if (this.src && (this.src.includes('googlesyndication') || this.src.includes('googleads'))) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'ad-loaded',
                        src: this.src
                      }));
                    }
                  });
                }
                return element;
              };
              
              return true;
            })();
          `}
        />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
