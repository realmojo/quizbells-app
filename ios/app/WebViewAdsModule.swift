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
      print("🔍 WebViewAdsModule: Starting WebView search...")
      
      let webViews = self.findAllWebViews()
      var registeredCount = 0
      
      if webViews.isEmpty {
        print("⚠️ No WebViews found, retrying in 1 second...")
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
          let retryWebViews = self.findAllWebViews()
          for webView in retryWebViews {
            // 🔥 정확한 API: GADMobileAds.sharedInstance.register
            GADMobileAds.sharedInstance().register(webView)
            registeredCount += 1
            print("✅ WebView registered: \(webView)")
          }
          
          resolve([
            "success": true,
            "message": "Registered \(registeredCount) WebViews",
            "registeredCount": registeredCount
          ])
        }
      } else {
        for webView in webViews {
          // 🔥 정확한 API: GADMobileAds.sharedInstance.register
          GADMobileAds.sharedInstance.register(webView)
          registeredCount += 1
          print("✅ WebView registered: \(webView)")
        }
        
        resolve([
          "success": true,
          "message": "Registered \(registeredCount) WebViews",
          "registeredCount": registeredCount
        ])
      }
    }
  }
  
  private func findAllWebViews() -> [WKWebView] {
    var webViews: [WKWebView] = []
    
    for scene in UIApplication.shared.connectedScenes {
      if let windowScene = scene as? UIWindowScene {
        for window in windowScene.windows {
          searchForWebViews(in: window, webViews: &webViews)
        }
      }
    }
    
    print("📊 Found \(webViews.count) WebViews")
    return webViews
  }
  
  private func searchForWebViews(in view: UIView, webViews: inout [WKWebView]) {
    if let webView = view as? WKWebView {
      webViews.append(webView)
    }
    
    for subview in view.subviews {
      searchForWebViews(in: subview, webViews: &webViews)
    }
  }
}