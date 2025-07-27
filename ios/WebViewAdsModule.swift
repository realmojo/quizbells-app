import Foundation
import React
import GoogleMobileAds
import WebKit

@objc(WebViewAdsModule)
class WebViewAdsModule: NSObject {
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  @objc
  func registerAllWebViews(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      do {
        print("🔍 Searching for WKWebViews...")
        
        // 현재 화면에서 모든 WKWebView를 찾아서 등록
        let webViews = self.findAllWebViews()
        var registeredCount = 0
        
        if webViews.isEmpty {
          print("⚠️ No WKWebViews found. Retrying in 1 second...")
          
          // 1초 후 다시 시도
          DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            let retryWebViews = self.findAllWebViews()
            
            for webView in retryWebViews {
              MobileAds.shared.register(webView)
              registeredCount += 1
              print("✅ WebView registered with Google Mobile Ads (retry): \(webView)")
            }
            
            let message = "Successfully registered \(registeredCount) WebViews with Google Mobile Ads (after retry)"
            print(message)
            resolve([
              "success": true,
              "message": message,
              "registeredCount": registeredCount
            ])
          }
        } else {
          for webView in webViews {
            MobileAds.shared.register(webView)
            registeredCount += 1
            print("✅ WebView registered with Google Mobile Ads: \(webView)")
          }
          
          let message = "Successfully registered \(registeredCount) WebViews with Google Mobile Ads"
          print(message)
          resolve([
            "success": true,
            "message": message,
            "registeredCount": registeredCount
          ])
        }
        
      } catch {
        let errorMessage = "Failed to register WebViews: \(error.localizedDescription)"
        print("❌ \(errorMessage)")
        reject("WEBVIEW_REGISTRATION_ERROR", errorMessage, error)
      }
    }
  }
  
  // 현재 화면에서 모든 WKWebView를 찾는 헬퍼 메서드
  private func findAllWebViews() -> [WKWebView] {
    var webViews: [WKWebView] = []
    
    // 모든 window에서 검색
    for scene in UIApplication.shared.connectedScenes {
      if let windowScene = scene as? UIWindowScene {
        for window in windowScene.windows {
          searchForWebViews(in: window, webViews: &webViews)
        }
      }
    }
    
    print("📊 Total WKWebViews found: \(webViews.count)")
    return webViews
  }
  
  private func searchForWebViews(in view: UIView, webViews: inout [WKWebView]) {
    if let webView = view as? WKWebView {
      webViews.append(webView)
      print("🔍 Found WKWebView: \(webView)")
    }
    
    for subview in view.subviews {
      searchForWebViews(in: subview, webViews: &webViews)
    }
  }
}
