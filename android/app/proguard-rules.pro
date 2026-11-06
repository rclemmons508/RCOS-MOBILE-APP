# R8 / ProGuard rules for the RCOS release build.
#
# Capacitor's own consumer rules (shipped in @capacitor/android) already keep
# every class extending com.getcapacitor.Plugin, its @PluginMethod /
# @PermissionCallback / @ActivityCallback methods, the annotation types, and
# Cordova plugin classes. The rules below repeat the essentials for our own
# code so a change in Capacitor's consumer rules can't silently break it.
#
# IMPORTANT: after any change here, smoke-test the signed release APK on a
# device (login, biometric unlock, AI voice call + speaker toggle, Gmail
# connect deep link, external browser links) before shipping.

# --- Capacitor core (plugins are looked up by class name from
# --- capacitor.plugins.json and their methods are invoked by reflection) ---
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep @interface com.getcapacitor.annotation.** { *; }
-keep @interface com.getcapacitor.PluginMethod { *; }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# WebView JavaScript bridge methods.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- Cordova compatibility layer ---
-keep public class * extends org.apache.cordova.* {
    public <methods>;
    public <fields>;
}

# --- App code ---
# Custom native plugin registered from MainActivity (JS calls it by name).
-keep class com.rcsolutions.rcosmobile.AudioRoutePlugin { *; }
-keep class com.rcsolutions.rcosmobile.MainActivity { *; }

# Third-party plugin: @aparajita/capacitor-biometric-auth.
-keep class com.aparajita.capacitor.biometricauth.** { *; }

# Readable crash stack traces (upload mapping.txt from CI to de-obfuscate).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
