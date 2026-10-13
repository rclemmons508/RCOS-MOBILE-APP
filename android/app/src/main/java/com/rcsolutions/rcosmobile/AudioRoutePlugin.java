package com.rcsolutions.rcosmobile;

import android.content.Context;
import android.media.AudioManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Routes voice-call audio to the earpiece by default and lets the web UI
 * toggle the loudspeaker. Used by the LiveKit AI-receptionist call screen.
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
            am.setSpeakerphoneOn(false);
        }
        call.resolve();
    }

    /** Turn the loudspeaker on or off for the current call. */
    @PluginMethod
    public void setSpeakerphone(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        AudioManager am = audioManager();
        if (am != null) {
            am.setSpeakerphoneOn(enabled);
        }
        JSObject ret = new JSObject();
        ret.put("speakerphone", enabled);
        call.resolve(ret);
    }

    /** Undo setCommunicationMode: loudspeaker off, previous audio mode restored. */
    @PluginMethod
    public void restoreAudioMode(PluginCall call) {
        AudioManager am = audioManager();
        if (am != null) {
            am.setSpeakerphoneOn(false);
            am.setMode(modeSaved ? previousMode : AudioManager.MODE_NORMAL);
            modeSaved = false;
        }
        call.resolve();
    }
}
