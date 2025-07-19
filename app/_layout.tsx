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
const { WebViewAds } = NativeModules;

// const BASE_WEBVIEW_URL =
//   "https://google.github.io/webview-ads/test/#api-for-ads-tests";
const BASE_WEBVIEW_URL = "https://quizbells.com";
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

  // 2. WebView 로드 완료 후 localStorage에 저장
  const handleWebViewLoad = async () => {
    console.log("handleWebViewLoad");
    const quizbellsAuth = await getQuizbellsAuth();

    if (quizbellsAuth && webViewRef.current) {
      const jsCode = `localStorage.setItem("quizbells-auth", '${JSON.stringify(
        quizbellsAuth
      )}'); true;`;
      webViewRef.current.injectJavaScript(jsCode);
    }

    if (!isWebViewRegistered) {
      try {
        console.log("WebView loaded, attempting registration...");

        if (!WebViewAds) {
          console.error("WebViewAds module not available");
          return;
        }

        // 모든 WebView를 등록하는 방식으로 변경
        const result = await WebViewAds.registerAllWebViews();
        console.log("Registration result:", result);

        setIsWebViewRegistered(true);

        // 등록 후 잠시 대기 후 페이지 새로고침 ( 광고가 등록 되었는지 확인 용 )
        // setTimeout(() => {
        //   webViewRef.current?.reload();
        // }, 10000);
      } catch (error) {
        console.error("WebView registration error:", error);
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

  const handleMessage = (event: any) => {
    const message = event.nativeEvent.data;
    console.log("WebView Message: ", message);
  };

  // 🔧 콜백 함수 정의
  const reloadWebView = useCallback(
    (link: string) => {
      console.log("기존 URL:", webviewUrl);
      console.log("새로운 URL:", link);

      // 1. 현재 로딩 중단
      // if (webViewRef.current) {
      //   webViewRef.current.stopLoading();
      // }

      // 2. URL 상태 변경
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
        isPushInitializedRef.current = true; // ✅ 이 시점에만 true로 변경
      } catch (e) {
        handleRegistrationError(`${e}`);
      } finally {
        // setWebviewUrl(`${BASE_WEBVIEW_URL}/quiz`);
        setWebviewUrl(`${BASE_WEBVIEW_URL}`);
      }
    };

    initPush();

    return () => {
      notificationHandlerRef.current?.cleanup();
      notificationHandlerRef.current = null;
      isPushInitializedRef.current = false; // ✅ 이 시점에만 true로 변경
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
          mediaPlaybackRequiresUserAction={false}
          thirdPartyCookiesEnabled={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={false}
          onLoadEnd={handleWebViewLoad}
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest} // 🔥 이 줄 추가
          onMessage={handleMessage}
          onError={handleError}
          injectedJavaScript={`
            (function() {a
              const originalConsoleLog = console.log;
              console.log = function(message) {
                window.ReactNativeWebView.postMessage(message);
                originalConsoleLog(message);
              }
            })();
            true;
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
