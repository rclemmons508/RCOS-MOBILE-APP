package com.rcsolutions.rcosmobile;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens the phone's notification settings for this app, so the owner can
 * turn live-call alerts back on after the notification permission was
 * denied. Used by the in-app "call alerts are off" banner.
 *
 * Android 8+ (API 26) has a dedicated notification-settings screen;
 * older versions fall back to the app-details page, which is where
 * notifications were managed before that screen existed.
 */
@CapacitorPlugin(name = "AppSettings")
public class AppSettingsPlugin extends Plugin {

    /** Open this app's notification settings (or app details below API 26). */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("No context available");
            return;
        }
        String pkg = ctx.getPackageName();
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, pkg);
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + pkg));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("Notification settings could not be opened");
        }
    }
}
