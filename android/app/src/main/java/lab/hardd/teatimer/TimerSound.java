package lab.hardd.teatimer;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.content.res.Resources;
import android.net.Uri;
import java.io.IOException;

enum TimerSound {
    SILENT("silent", 0, R.string.tea_timer_sound_silent),
    DEFAULT("default", R.raw.notification, R.string.tea_timer_sound_default),
    GONG_CLEAR("gong_clear", R.raw.gong_clear, R.string.tea_timer_sound_gong_clear),
    GONG_SOFT("gong_soft", R.raw.gong_soft, R.string.tea_timer_sound_gong_soft),
    SINGING_BOWL("singing_bowl", R.raw.singing_bowl, R.string.tea_timer_sound_singing_bowl);

    final String id;
    final int audio;
    final int label;

    TimerSound(String id, int audio, int label) {
        this.id = id;
        this.audio = audio;
        this.label = label;
    }

    static TimerSound fromId(String id) {
        for (TimerSound sound : values()) {
            if (sound.id.equals(id)) return sound;
        }
        return DEFAULT;
    }

    TimerSound available(Context context) {
        if (this == DEFAULT || this == SILENT) return this;
        try (AssetFileDescriptor file = context.getResources().openRawResourceFd(audio)) {
            return file != null && file.getLength() > 0 ? this : DEFAULT;
        } catch (Resources.NotFoundException | IOException error) {
            return DEFAULT;
        }
    }

    String channelId() {
        return this == DEFAULT ? "tea-timer-alerts" : "tea-timer-alerts-" + id;
    }

    Uri uri(Context context) {
        if (this == SILENT) return null;
        return new Uri.Builder().scheme("android.resource").authority(context.getPackageName())
            .appendPath("raw").appendPath(context.getResources().getResourceEntryName(audio)).build();
    }
}
