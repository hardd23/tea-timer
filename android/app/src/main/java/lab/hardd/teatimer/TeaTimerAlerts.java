package lab.hardd.teatimer;

import android.app.AlarmManager;
import android.app.KeyguardManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.os.Build;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import java.util.Locale;
import org.json.JSONException;
import org.json.JSONObject;

public class TeaTimerAlerts extends BroadcastReceiver {
    private static final String SNAPSHOT = "snapshot";
    private static final String BREWING = "brewing";
    private static final String COOLING = "cooling";
    private static final String TIMER_ID = "timer_id";
    private static final String DEADLINE = "deadline";
    private static final String LANGUAGE = "alert_language";
    private static final int NOTIFICATION_ID = 6101;
    private static final int LEGACY_COOLING_NOTIFICATION_ID = 6102;
    private static final long MINUTE = 60_000L;
    private static boolean activityActive;

    private static final class Alert {
        final String timerId;
        final long at;
        final String phase;
        final int duration;
        final int pourNumber;

        Alert(String timerId, long at, String phase, int duration, int pourNumber) {
            this.timerId = timerId;
            this.at = at;
            this.phase = phase;
            this.duration = duration;
            this.pourNumber = pourNumber;
        }

        int code() { return requestCode(phase); }
    }

    private static int requestCode(String phase) { return BREWING.equals(phase) ? 6101 : 6102; }

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("tea-timer-session", Context.MODE_PRIVATE);
    }

    static synchronized void setLanguage(Context context, String language) {
        if (!"ru".equals(language) && !"en".equals(language)) return;
        SharedPreferences storage = preferences(context);
        if (language.equals(storage.getString(LANGUAGE, null))) return;
        storage.edit().putString(LANGUAGE, language).apply();
        prepareChannels(context, snapshot(storage.getString(SNAPSHOT, null)));
    }

    private static Context localizedContext(Context context) {
        String language = preferences(context).getString(LANGUAGE, null);
        if (language == null) return context;
        Configuration configuration = new Configuration(context.getResources().getConfiguration());
        configuration.setLocale(Locale.forLanguageTag(language));
        return context.createConfigurationContext(configuration);
    }

    static synchronized void setActivityActive(Context context, boolean active) {
        activityActive = active;
        if (active && !notificationsInBackground(context)) clearNotification(context);
        else TeaTimerAudio.stopPreview(null);
    }

    static synchronized void preview(Context context, TimerSound sound, String token, Runnable finished) {
        if (notificationsInBackground(context)) finished.run();
        else TeaTimerAudio.playPreview(context, sound, token, finished);
    }

    static synchronized void clearNotification(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.cancel(NOTIFICATION_ID);
        manager.cancel(LEGACY_COOLING_NOTIFICATION_ID);
    }

    static boolean shouldPostNotification(boolean active, boolean interactive, boolean locked) {
        return !active || !interactive || locked;
    }

    private static boolean notificationsInBackground(Context context) {
        return shouldPostNotification(activityActive, context.getSystemService(PowerManager.class).isInteractive(),
            context.getSystemService(KeyguardManager.class).isKeyguardLocked());
    }

    private static JSONObject snapshot(String value) {
        try { return value == null ? new JSONObject() : new JSONObject(value); }
        catch (JSONException error) { return new JSONObject(); }
    }

    private static long coolingDuration(JSONObject state, JSONObject timer, boolean isBrewing) {
        Object value = isBrewing ? state.opt("coolingDurationMinutes") : timer.opt("coolingDurationMs");
        if (!(value instanceof Number)) return 3 * MINUTE;
        double minutes = ((Number) value).doubleValue() / (isBrewing ? 1 : MINUTE);
        return minutes == (int) minutes && minutes >= 1 && minutes <= 5 ? (int) minutes * MINUTE : 3 * MINUTE;
    }

    private static Alert alert(JSONObject state, String phase) {
        if (state.optInt("schema") != 1) return null;
        JSONObject timer = state.optJSONObject("timer");
        if (timer == null) return null;
        String id = timer.optString("id");
        long end = timer.optLong("endAt", 0);
        int duration = timer.optInt("duration");
        if (id.isEmpty() || end <= 0 || end > 8_640_000_000_000_000L || duration <= 0 || duration > 3595) return null;
        boolean brewing = BREWING.equals(timer.optString("phase"));
        int count = state.optInt("pourCount");
        int number = brewing ? Math.min(99, count + 1) : timer.optInt("pourNumber", count);
        number = Math.max(1, Math.min(99, number));
        if (BREWING.equals(phase)) return brewing ? new Alert(id, end, phase, duration, number) : null;
        if (!COOLING.equals(phase) || Boolean.FALSE.equals(state.opt("coolingEnabled"))
            || (!brewing && (!COOLING.equals(timer.optString("phase"))
                || Boolean.FALSE.equals(timer.opt("coolingAlertEnabled"))
                || Boolean.TRUE.equals(timer.opt("coolingAlertHandled"))))) return null;
        return new Alert(id, end + coolingDuration(state, timer, brewing), phase, duration, number);
    }

    static synchronized String restore(Context context) {
        String value = preferences(context).getString(SNAPSHOT, null);
        JSONObject state = snapshot(value);
        prepareChannels(context, state);
        reconcile(context, null, state, true);
        return value;
    }

    static synchronized boolean save(Context context, String value) {
        SharedPreferences storage = preferences(context);
        JSONObject previous = snapshot(storage.getString(SNAPSHOT, null));
        if (!storage.edit().putString(SNAPSHOT, value).commit()) return false;
        JSONObject current = snapshot(value);
        if (selectedSound(previous, BREWING) != selectedSound(current, BREWING)
            || selectedSound(previous, COOLING) != selectedSound(current, COOLING)) prepareChannels(context, current);
        JSONObject oldTimer = previous.optJSONObject("timer");
        JSONObject newTimer = current.optJSONObject("timer");
        boolean sessionReset = !previous.isNull("sessionId") && current.isNull("sessionId");
        if (sessionReset || (oldTimer != null && (newTimer == null
            || !oldTimer.optString("id").equals(newTimer.optString("id"))))) clearNotification(context);
        reconcile(context, previous, current, sessionReset);
        return true;
    }

    private static void reconcile(Context context, JSONObject previous, JSONObject current, boolean force) {
        for (String phase : new String[]{ BREWING, COOLING }) {
            Alert oldAlert = previous == null ? null : alert(previous, phase);
            Alert next = alert(current, phase);
            boolean same = oldAlert == null ? next == null
                : next != null && oldAlert.timerId.equals(next.timerId) && oldAlert.at == next.at;
            if (same && !force) continue;
            if (next == null || next.at <= System.currentTimeMillis() || delivered(context, next)) {
                cancel(context, phase);
            } else schedule(context, next);
        }
    }

    private static Intent intent(Context context, String phase) {
        return new Intent(context, TeaTimerAlerts.class).setAction(phase);
    }

    private static void cancel(Context context, String phase) {
        PendingIntent pending = PendingIntent.getBroadcast(context, requestCode(phase), intent(context, phase),
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (pending == null) return;
        context.getSystemService(AlarmManager.class).cancel(pending);
        pending.cancel();
    }

    private static void schedule(Context context, Alert alert) {
        Intent intent = intent(context, alert.phase).putExtra(TIMER_ID, alert.timerId).putExtra(DEADLINE, alert.at);
        PendingIntent pending = PendingIntent.getBroadcast(context, alert.code(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()) {
                manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alert.at, pending);
                return;
            }
        } catch (SecurityException ignored) {
            // Exact access may have changed since checking it.
        }
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alert.at, pending);
    }

    private static String deliveredKey(Alert alert) { return "alert_delivered_" + alert.phase; }

    private static boolean delivered(Context context, Alert alert) {
        return alert.timerId.equals(preferences(context).getString(deliveredKey(alert), null));
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String phase = intent.getAction();
        if (AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED.equals(phase)) {
            restore(context);
        } else {
            deliver(context, intent.getStringExtra(TIMER_ID), phase, intent.getLongExtra(DEADLINE, -1));
        }
    }

    /**
     * Both the alarm and the WebView can claim an event. The first claim plays
     * the foreground sound or posts the background notification.
     */
    static synchronized boolean deliver(Context context, String timerId, String phase, long scheduledAt) {
        JSONObject saved = snapshot(preferences(context).getString(SNAPSHOT, null));
        Alert current = alert(saved, phase);
        long now = System.currentTimeMillis();
        if (current == null || !current.timerId.equals(timerId) || now < current.at
            || (scheduledAt != -1 && scheduledAt != current.at) || delivered(context, current)) return false;
        Alert cooling = alert(saved, COOLING);
        if (BREWING.equals(phase) && cooling != null && now >= cooling.at) return false;

        TimerSound sound = selectedSound(saved, phase);
        if (!notificationsInBackground(context)) {
            preferences(context).edit().putString(deliveredKey(current), timerId).apply();
            TeaTimerAudio.playAlert(context, sound);
            cancel(context, phase);
            return true;
        }

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (!manager.areNotificationsEnabled()) return false;
        sound = sound.available(context);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = manager.getNotificationChannel(sound.channelId());
            if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
            if (channel == null) createChannel(context, manager, sound);
        }
        preferences(context).edit().putString(deliveredKey(current), timerId).apply();
        TeaTimerAudio.stop();

        try {
            notify(context, manager, current, sound);
            return true;
        } catch (SecurityException ignored) {
            return false;
        } finally {
            cancel(context, phase);
        }
    }

    private static TimerSound selectedSound(JSONObject state, String phase) {
        JSONObject sounds = state.optJSONObject("sounds");
        return TimerSound.fromId(sounds == null ? null : sounds.optString(phase));
    }

    private static void prepareChannels(Context context, JSONObject state) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        TimerSound brewing = selectedSound(state, BREWING).available(context);
        TimerSound cooling = selectedSound(state, COOLING).available(context);
        createChannel(context, manager, brewing);
        if (cooling != brewing) createChannel(context, manager, cooling);
    }

    @androidx.annotation.RequiresApi(Build.VERSION_CODES.O)
    private static void createChannel(Context context, NotificationManager manager, TimerSound sound) {
        Context localized = localizedContext(context);
        String title = localized.getString(R.string.tea_timer_alerts);
        if (sound != TimerSound.DEFAULT) title = localized.getString(R.string.tea_timer_sound_channel, localized.getString(sound.label));
        NotificationChannel channel = new NotificationChannel(sound.channelId(), title, NotificationManager.IMPORTANCE_HIGH);
        channel.setSound(sound.uri(context), TeaTimerAudio.attributes());
        manager.createNotificationChannel(channel);
    }

    static String formatDuration(Context context, int duration) {
        int minutes = duration / 60;
        int seconds = duration % 60;
        if (minutes == 0) return context.getString(R.string.tea_timer_seconds, seconds);
        if (seconds == 0) return context.getString(R.string.tea_timer_minutes, minutes);
        return context.getString(R.string.tea_timer_minutes_seconds, minutes, seconds);
    }

    private static void notify(Context context, NotificationManager manager, Alert alert, TimerSound sound) {
        Context localized = localizedContext(context);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, sound.channelId())
            .setPriority(NotificationCompat.PRIORITY_HIGH);
        if (sound == TimerSound.SILENT) builder.setSilent(true);
        else if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) builder.setSound(sound.uri(context));
        PendingIntent open = PendingIntent.getActivity(context, NOTIFICATION_ID, new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE);
        String event = localized.getString(BREWING.equals(alert.phase) ? R.string.tea_timer_brew_done : R.string.tea_timer_cooling_done,
            alert.pourNumber);
        String brewTime = localized.getString(R.string.tea_timer_brewing_time, formatDuration(localized, alert.duration));
        clearNotification(context);
        manager.notify(NOTIFICATION_ID, builder.setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(localized.getString(R.string.app_name))
            .setContentText(event + " · " + brewTime)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(event + "\n" + brewTime))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build());
    }
}
