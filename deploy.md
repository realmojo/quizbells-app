app.json 에서 버전코드올리기, android/app/bundle.gradle
version="1.0.x"
android.versionCode=x

android
npx expo prebuild --platform android

ios
npx expo prebuild --platform ios
EXPO_NO_WATCHMAN=1 expo run:ios --device

<!-- eas build --profile production --platform android --local -->

// 플레이스토어 올릴 때
cd android
NODE_ENV=production ./gradlew bundleRelease

keytool -list -v -alias my-key-alias -keystore "/Users/realmojo/Desktop/d/quizbells-app/android/release.jks" -storepass "wjdaksrud!@3" -keypass "wjdaksrud!@3"

// 로컬앱에 프로덕션 모드로 설치하고 싶을 때
NODE_ENV=production ./gradlew assembleRelease
adb install app/build/outputs/apk/release/app-release.apk

// 앱스토어 올릴 떄
npx expo prebuild --platform ios
cd ios
pod install

Xcode 에서 product -> archive (release 빌드)
Windows -> Organizer
Distribute App -> App Store Connect 전송

<!-- eas build --platform android --local -->

이미지 오류나면 아래 명령어 실행
find android/app/src/main/res/ -name "\*.webp" -delete

로그 캣 초기화
adb logcat -c
adb logcat | grep ReactNativeJS

watchman 오류시 중지했다가 다시 실행
watchman shutdown-server
watchman

❌ error: Sandbox: bash(12201) deny(1) file-write-create /Users/realmojo/Desktop/d/cpnow-app/ios/Pods/resources-to-copy-imageNotification.txt (in target 'imageNotification' from project 'app')

Build Settings -> User Script Sandboxing -> No
