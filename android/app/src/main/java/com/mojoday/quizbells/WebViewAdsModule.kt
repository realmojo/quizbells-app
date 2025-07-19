package com.mojoday.quizbells

import android.webkit.WebView
import android.webkit.CookieManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.UiThreadUtil
import com.google.android.gms.ads.MobileAds
import android.util.Log
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments

class WebViewAdsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "WebViewAds"
    }

    @ReactMethod
    fun registerAllWebViews(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val activity = currentActivity
                if (activity != null) {
                    // 모든 WebView를 찾아서 등록
                    registerWebViewsRecursively(activity.findViewById(android.R.id.content))
                    Log.d("WebViewAds", "All WebViews registered successfully")
                    promise.resolve("All WebViews registered")
                } else {
                    promise.reject("ERROR", "Activity not found")
                }
            } catch (e: Exception) {
                Log.e("WebViewAds", "Error registering WebViews", e)
                promise.reject("ERROR", e.message)
            }
        }
    }

    private fun registerWebViewsRecursively(view: android.view.View) {
        if (view is WebView) {
            // WebView 설정
            CookieManager.getInstance().setAcceptThirdPartyCookies(view, true)
            view.settings.javaScriptEnabled = true
            view.settings.domStorageEnabled = true
            view.settings.mediaPlaybackRequiresUserGesture = false
            
            // WebView 등록
            MobileAds.registerWebView(view)
            Log.d("WebViewAds", "WebView registered: ${view.javaClass.simpleName}")
        } else if (view is android.view.ViewGroup) {
            for (i in 0 until view.childCount) {
                registerWebViewsRecursively(view.getChildAt(i))
            }
        }
    }

    @ReactMethod
    fun testModule(promise: Promise) {
        promise.resolve("WebViewAds module is working!")
    }
}