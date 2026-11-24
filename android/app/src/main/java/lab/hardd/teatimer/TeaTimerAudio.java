package lab.hardd.teatimer;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import java.io.IOException;
import java.util.EnumMap;

final class TeaTimerAudio {
    private static final EnumMap<TimerSound, Clip> clips = new EnumMap<>(TimerSound.class);
    private static Playback active;

    private static final class Clip {
        MediaPlayer player;
        boolean ready;
    }

    private static final class Playback {
        TimerSound sound;
        final String previewToken;
        final Runnable finished;
        MediaPlayer player;

        Playback(TimerSound sound, String previewToken, Runnable finished) {
            this.sound = sound;
            this.previewToken = previewToken;
            this.finished = finished;
        }
    }

    private TeaTimerAudio() {}

    static AudioAttributes attributes() {
        return new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).build();
    }

    static synchronized void prepare(Context context) {
        for (TimerSound sound : TimerSound.values()) {
            if (sound != TimerSound.SILENT) prepareClip(context.getApplicationContext(), sound);
        }
    }

    static synchronized void playAlert(Context context, TimerSound sound) {
        if (sound == TimerSound.SILENT) finishActive();
        else start(context.getApplicationContext(), new Playback(sound, null, null));
    }

    static synchronized void playPreview(Context context, TimerSound sound, String token, Runnable finished) {
        if (sound == TimerSound.SILENT || (active != null && active.previewToken == null)) {
            finished.run();
            return;
        }
        start(context.getApplicationContext(), new Playback(sound, token, finished));
    }

    static synchronized void stopPreview(String token) {
        if (active != null && active.previewToken != null
            && (token == null || active.previewToken.equals(token))) finishActive();
    }

    static synchronized void stop() {
        finishActive();
    }

    static synchronized void release() {
        finishActive();
        for (Clip clip : clips.values()) {
            if (clip.player != null) clip.player.release();
        }
        clips.clear();
    }

    private static void start(Context context, Playback request) {
        finishActive();
        active = request;
        startWhenReady(context, request);
    }

    private static Clip prepareClip(Context context, TimerSound sound) {
        Clip cached = clips.get(sound);
        if (cached != null) return cached;
        Clip clip = new Clip();
        clips.put(sound, clip);
        try (AssetFileDescriptor file = context.getResources().openRawResourceFd(sound.audio)) {
            if (file == null) return clip;
            clip.player = new MediaPlayer();
            clip.player.setAudioAttributes(attributes());
            clip.player.setDataSource(file);
            clip.player.setOnPreparedListener(player -> onPrepared(context, sound, clip));
            clip.player.setOnCompletionListener(TeaTimerAudio::onCompleted);
            clip.player.setOnErrorListener((player, what, extra) -> {
                onError(context, sound, clip, player);
                return true;
            });
            clip.player.prepareAsync();
        } catch (IOException | RuntimeException error) {
            if (clip.player != null) clip.player.release();
            clip.player = null;
        }
        return clip;
    }

    private static void startWhenReady(Context context, Playback request) {
        Clip clip = prepareClip(context, request.sound);
        if (clip.player == null) {
            playFallback(context, request);
            return;
        }
        if (!clip.ready) return;

        clips.remove(request.sound);
        request.player = clip.player;
        try {
            request.player.start();
        } catch (RuntimeException error) {
            request.player.release();
            request.player = null;
            clips.put(request.sound, new Clip());
            playFallback(context, request);
            return;
        }
        prepareClip(context, request.sound);
    }

    private static void playFallback(Context context, Playback request) {
        if (request.sound == TimerSound.DEFAULT) {
            finishActive();
        } else {
            request.sound = TimerSound.DEFAULT;
            startWhenReady(context, request);
        }
    }

    private static synchronized void onPrepared(Context context, TimerSound sound, Clip clip) {
        if (clips.get(sound) != clip) return;
        clip.ready = true;
        if (active != null && active.player == null && active.sound == sound) startWhenReady(context, active);
    }

    private static synchronized void onCompleted(MediaPlayer player) {
        if (active != null && active.player == player) finishActive();
    }

    private static synchronized void onError(Context context, TimerSound sound, Clip clip, MediaPlayer player) {
        if (active != null && active.player == player) {
            finishActive();
        } else if (clips.get(sound) == clip && clip.player == player) {
            player.release();
            clip.player = null;
            if (active != null && active.player == null && active.sound == sound) playFallback(context, active);
        }
    }

    private static void finishActive() {
        Playback previous = active;
        active = null;
        if (previous == null) return;
        if (previous.player != null) previous.player.release();
        if (previous.finished != null) previous.finished.run();
    }
}
