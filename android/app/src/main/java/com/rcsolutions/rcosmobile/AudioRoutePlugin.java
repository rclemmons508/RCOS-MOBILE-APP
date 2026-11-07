package com.rcsolutions.rcosmobile;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

/**
 * Routes voice-call audio to the earpiece by default and lets the web UI
 * toggle the loudspeaker. Used by the LiveKit AI-receptionist call screen.
 *
 * On Android 12+ (API 31) setSpeakerphoneOn() is deprecated and unreliable
 * in MODE_IN_COMMUNICATION, so the speaker is selected with
 * setCommunicationDevice() and released with clearCommunicationDevice()
 * (which returns to the system default: a connected headset/Bluetooth device,
 * else the earpiece). Older versions keep the setSpeakerphoneOn() path.
 */
@CapacitorPlugin(name = "AudioRoute")
public class AudioRoutePlugin extends Plugin {
    private int previousMode = AudioManager.MODE_NORMAL;
    private boolean modeSaved = false;

    private AudioManager audioManager() {
        Context ctx = getContext();
        if (ctx == null) return null;
        return (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
    }

    /** Speaker on/off for the current call. Returns true if the route was applied. */
    private boolean applySpeaker(AudioManager am, boolean enabled) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!enabled) {
                am.clearCommunicationDevice();
                return true;
            }
            List<AudioDeviceInfo> devices = am.getAvailableCommunicationDevices();
            for (AudioDeviceInfo device : devices) {
                if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                    return am.setCommunicationDevice(device);
                }
            }
            return false;
        }
        setSpeakerphoneLegacy(am, enabled);
        return true;
    }

    @SuppressWarnings("deprecation")
    private void setSpeakerphoneLegacy(AudioManager am, boolean enabled) {
        am.setSpeakerphoneOn(enabled);
    }

    /** Put the phone in voice-call audio mode and route output to the earpiece. */
    @PluginMethod
    public void setCommunicationMode(PluginCall call) {
        AudioManager am = audioManager();
        if (am != null) {
            if (!modeSaved) {
                previousMode = am.getMode();
                modeSaved = true;
            }
            am.setMode(AudioManager.MODE_IN_COMMUNICATION);
            applySpeaker(am, false);
        }
        call.resolve();
    }

    /** Turn the loudspeaker on or off for the current call. */
    @PluginMethod
    public void setSpeakerphone(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        AudioManager am = audioManager();
        boolean applied = false;
        if (am != null) {
            applied = applySpeaker(am, enabled);
        }
        JSObject ret = new JSObject();
        // Report the route actually in effect so the UI toggle stays truthful.
        ret.put("speakerphone", applied ? enabled : !enabled);
        call.resolve(ret);
    }

    /** Undo setCommunicationMode: loudspeaker off, previous audio mode restored. */
    @PluginMethod
    public void restoreAudioMode(PluginCall call) {
        AudioManager am = audioManager();
        if (am != null) {
            applySpeaker(am, false);
            am.setMode(modeSaved ? previousMode : AudioManager.MODE_NORMAL);
            modeSaved = false;
        }
        call.resolve();
    }
}
