// FirebaseNotificationHandler.ts
import notifee, { EventType } from "@notifee/react-native";
import { getApp, initializeApp } from "@react-native-firebase/app";
import {
  AuthorizationStatus,
  FirebaseMessagingTypes,
  getInitialNotification,
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
} from "@react-native-firebase/messaging";
import * as Device from "expo-device";
import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyC_E2U2dgb8Smz-dBzcrpVlsQtwnxOBCMQ",
  authDomain: "quizbells-2d26a.firebaseapp.com",
  projectId: "quizbells-2d26a",
  storageBucket: "quizbells-2d26a.firebasestorage.app",
  messagingSenderId: "116519638071",
  appId: "1:116519638071:web:f03b878d06712a4e1adbb2",
  measurementId: "G-KH8RLMC19C",
  databaseURL: "https://quizbells-2d26a-default-rtdb.firebaseio.com",
};

class FirebaseNotificationHandler {
  private messaging: any = null;
  private app: any = null;
  private unsubscribeOnMessage: (() => void) | null = null;
  private unsubscribeOnNotificationOpenedApp: (() => void) | null = null;
  private unsubscribeNotifeeEvents: (() => void) | null = null;
  private webviewReloadCallback: ((link: string) => void) | null = null;
  private channelId: string = "default";

  constructor(webviewReloadCallback?: (link: string) => void) {
    this.webviewReloadCallback = webviewReloadCallback || null;
    this.initialize();
  }

  // Firebase 앱 초기화
  private async getFirebaseApp() {
    if (this.app) return this.app;

    try {
      this.app = getApp(); // 이미 초기화된 앱 반환
    } catch (e) {
      this.app = await initializeApp(firebaseConfig);
    }
    return this.app;
  }

  // 초기화 메서드
  private async initialize() {
    console.log("🔥 Firebase 알림 이벤트 등록 시작");
    await this.setupNotificationChannel();
    await this.initializeMessaging();
    await this.registerNotificationEvents();
    console.log("🔥 Firebase 알림 이벤트 등록 완료");
  }

  // 알림 채널 설정 (Notifee)
  private async setupNotificationChannel() {
    this.channelId = await notifee.createChannel({
      id: "default",
      name: "퀴즈벨 알람",
      description: "퀴즈벨 채널알람 설명",
      importance: 4, // HIGH
      sound: "default",
      vibration: true,
    });

    console.log("✅ Notifee 채널 생성됨:", this.channelId);
  }

  // 테스트 알람
  public showTestNotification() {
    const testMessage = {
      data: {
        title: "퀴즈벨 알람🚀",
        body: "이제 알람을 받으실 수 있습니다.",
        fcm_options: {
          image: "https://quizbells.com/icons/android-icon-192x192.png",
        },
        link: "https://quizbells.com",
      },
      notification: {
        title: "퀴즈벨 알람🚀",
        body: "이제 알람을 받으실 수 있습니다.",
      },
    };
    console.log("테스트 알림 표시");
    this.showLocalNotification(testMessage as any);
  }

  // 메시징 초기화
  private async initializeMessaging() {
    this.app = await this.getFirebaseApp();
    this.messaging = getMessaging(this.app);
  }

  // 로컬 알림 표시 (Notifee)
  private async showLocalNotification(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage
  ) {
    const { notification, data } = remoteMessage;
    console.log(
      "showLocalNotification:",
      JSON.stringify(remoteMessage, null, 2)
    );

    // 이미지 URL 추출
    const imageUrl =
      data?.fcm_options?.image ||
      notification?.android?.imageUrl ||
      data?.imageUrl ||
      "";

    console.log("imageUrl", imageUrl);

    if (data?.link) {
      try {
        const params = {
          title: notification?.title || data?.title || "퀴즈벨 알람🚀",
          body:
            notification?.body ||
            data?.body ||
            "이제 알람을 받으실 수 있습니다",
          data: {
            link: data?.link,
            imageUrl: imageUrl,
            ...data,
          },
          android: {
            channelId: this.channelId,
            smallIcon: "notification_icon",
            largeIcon: imageUrl ?? undefined,
            pressAction: {
              id: "default",
            },
            importance: 4, // HIGH
          },
          ios: {
            attachments: imageUrl
              ? [
                  {
                    url: imageUrl,
                    thumbnailHidden: false,
                  },
                ]
              : [],
            sound: "default",
            foregroundPresentationOptions: {
              badge: true,
              sound: true,
              banner: true,
              list: true,
            },
          },
        };
        await notifee.displayNotification(params as any);
        console.log("✅ Notifee 알림 표시 완료");
      } catch (error) {
        console.error("❌ Notifee 알림 표시 실패:", error);
      }
    }
  }

  // 권한 요청
  public async requestUserPermission(): Promise<boolean> {
    if (!this.messaging) {
      await this.initializeMessaging();
    }

    if (!Device.isDevice) {
      Alert.alert("실제 디바이스에서만 작동합니다.");
      return false;
    }
    if (Platform.OS === "ios" && !Device.isDevice) {
      Alert.alert("iOS 시뮬레이터는 푸시 알림을 지원하지 않습니다.");
      return false;
    }

    // Notifee 권한 요청
    const notifeeSettings = await notifee.requestPermission();
    console.log("🔔 Notifee 권한 상태:", notifeeSettings);

    // Android 권한 요청
    if (Platform.OS === "android") {
      // Android 13(API 33) 이상만 권한 요청 필요
      const sdkVersion = Platform.Version;
      if (sdkVersion < 33) {
        console.log("🔔 Android 12 이하 - 권한 요청 필요 없음");
        return true;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );

      if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          "알림 권한이 차단되었습니다",
          "설정 화면에서 알림 권한을 직접 허용해 주세요.",
          [
            { text: "취소", style: "cancel" },
            {
              text: "설정 열기",
              onPress: () => Linking.openSettings(),
            },
          ]
        );
      }
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else if (Platform.OS === "ios") {
      // iOS 권한 요청
      const authStatus = await this.messaging.requestPermission();
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

      return enabled;
    }
    return false;
  }

  // FCM 토큰 가져오기
  public async getFCMToken(): Promise<string | undefined> {
    try {
      if (!this.messaging) {
        await this.initializeMessaging();
      }
      const token = await this.messaging.getToken();
      return token;
    } catch (error) {
      console.log("FCM Token Error:", error);
      return undefined;
    }
  }

  // 웹뷰 콜백 설정
  public setWebviewReloadCallback(callback: (link: string) => void) {
    this.webviewReloadCallback = callback;
  }

  // 링크 처리
  private handleNotificationLink(link: string) {
    if (this.webviewReloadCallback) {
      console.log("✅ 링크 처리:", link);
      this.webviewReloadCallback(link);
    } else {
      console.log("메세지 패싱 - 콜백 없음");
    }
  }

  // 알림 이벤트 등록
  private async registerNotificationEvents() {
    if (!this.messaging) {
      await this.initializeMessaging();
    }

    // 백그라운드 메시지 핸들러
    this.messaging.setBackgroundMessageHandler(
      async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
        console.log("📥 [백그라운드] 메시지 수신:");
        // 백그라운드에서는 시스템에서 자동 처리되므로 추가 작업 불필요
      }
    );

    // 포그라운드 수신 처리
    this.unsubscribeOnMessage = onMessage(
      this.messaging,
      async (remoteMessage) => {
        console.log("📥 [포그라운드] 메시지 수신:");
        await this.showLocalNotification(remoteMessage);
      }
    );

    // 백그라운드에서 알림 클릭
    this.unsubscribeOnNotificationOpenedApp = onNotificationOpenedApp(
      this.messaging,
      (remoteMessage) => {
        console.log("📲 백그라운드 알림 클릭 - 이벤트 발생!");
        console.log(
          "📲 수신된 데이터:",
          JSON.stringify(remoteMessage, null, 2)
        );

        if (remoteMessage?.data?.link) {
          this.handleNotificationLink(remoteMessage.data.link as string);
        } else {
          console.log("메세지 패싱");
        }
      }
    );

    // 종료 상태에서 알림 클릭
    getInitialNotification(this.messaging).then((remoteMessage) => {
      console.log("getInitialNotification remoteMessage: ", remoteMessage);
      if (remoteMessage) {
        console.log(
          "🚀 종료 상태에서 알림 클릭:",
          JSON.stringify(remoteMessage, null, 2)
        );
        if (remoteMessage?.data?.link) {
          console.log("🔗 초기 링크 처리:", remoteMessage.data.link);
          this.handleNotificationLink(remoteMessage.data.link as string);
        }
      } else {
        console.log("❌ 초기 알림 없음");
      }
    });

    // Notifee 이벤트 리스너 설정
    this.configureNotifeeEvents();
  }

  // Notifee 이벤트 설정
  private configureNotifeeEvents() {
    this.unsubscribeNotifeeEvents = notifee.onForegroundEvent(
      ({ type, detail }) => {
        console.log(
          "🔔 Notifee 포그라운드 이벤트:",
          type,
          JSON.stringify(detail, null, 2)
        );

        switch (type) {
          case EventType.DISMISSED:
            console.log("📱 알림이 dismiss됨:", detail.notification);
            break;
          case EventType.PRESS:
            console.log("📱 알림이 눌림:", detail.notification);
            const link = detail.notification?.data?.link;
            if (link) {
              this.handleNotificationLink(link as string);
            }
            break;
        }
      }
    );

    // 백그라운드 이벤트는 index.js에서 처리해야 합니다
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      console.log("🔔 Notifee 백그라운드 이벤트:", type, detail);

      if (type === EventType.PRESS) {
        const link = detail.notification?.data?.link;
        if (link) {
          // 백그라운드에서는 직접 링크 처리가 어려우므로
          // AsyncStorage 등을 사용해서 앱이 열릴 때 처리하도록 할 수 있습니다
          console.log("백그라운드에서 링크 저장:", link);
        }
      }
    });

    console.log("✅ Notifee 이벤트 리스너 설정 완료");
  }

  // 배지 카운트 설정
  public async setBadgeCount(count: number) {
    try {
      await notifee.setBadgeCount(count);
      console.log(`✅ 배지 카운트 설정: ${count}`);
    } catch (error) {
      console.error("❌ 배지 카운트 설정 실패:", error);
    }
  }

  // 모든 알림 취소
  public async cancelAllNotifications() {
    try {
      await notifee.cancelAllNotifications();
      console.log("✅ 모든 알림 취소됨");
    } catch (error) {
      console.error("❌ 알림 취소 실패:", error);
    }
  }

  // 클린업 메서드
  public async cleanup() {
    console.log("🧹 FirebaseNotificationHandler cleanup");

    if (this.unsubscribeOnMessage) {
      this.unsubscribeOnMessage();
      this.unsubscribeOnMessage = null;
    }

    if (this.unsubscribeOnNotificationOpenedApp) {
      this.unsubscribeOnNotificationOpenedApp();
      this.unsubscribeOnNotificationOpenedApp = null;
    }

    if (this.unsubscribeNotifeeEvents) {
      this.unsubscribeNotifeeEvents();
      this.unsubscribeNotifeeEvents = null;
    }

    // 모든 알림 취소
    await this.cancelAllNotifications();
    await this.setBadgeCount(1);

    this.webviewReloadCallback = null;
    this.messaging = null;
    this.app = null;
  }
}

export default FirebaseNotificationHandler;
