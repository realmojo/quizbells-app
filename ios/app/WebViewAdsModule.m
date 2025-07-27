#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WebViewAdsModule, NSObject)

RCT_EXTERN_METHOD(registerAllWebViews:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end