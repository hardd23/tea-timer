package lab.hardd.teatimer;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import org.json.JSONException;
import org.json.JSONObject;

public class TeaTimerAlerts extends BroadcastReceiver {
    private static final String SNAPSHOT = "snapshot";
    private static final String CHANNEL = "tea-timer-alerts";
    private static final String BREWING = "brewing";
    private static final String COOLING = "cooling";
    private static final String TIMER_ID = "timer_id";
    private static final String DEADLINE = "deadline";
    private static final long MINUTE = 60_000L;

    private static final class Alert {
        final String timerId;
        final long at;
        final String phase;

        Alert(String timerId, long at, String phase) {
            this.timerId = timerId;
            this.at = at;
            this.phase = phase;
        }

        int code() { return requestCode(phase); }
    }

    private static int requestCode(String phase) { return BREWING.equals(phase) ? 6101 : 6102; }

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("tea-timer-session", Context.MODE_PRIVATE);
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
        if (id.isEmpty() || end <= 0 || end > 8_640_000_000_000_000L) return null;
        boolean brewing = BREWING.equals(timer.optString("phase"));
        if (BREWING.equals(phase)) return brewing ? new Alert(id, end, phase) : null;
        if (!COOLING.equals(phase) || Boolean.FALSE.equals(state.opt("coolingEnabled"))
            || (!brewing && (!COOLING.equals(timer.optString("phase"))
                || Boolean.FALSE.equals(timer.opt("coolingAlertEnabled"))
                || Boolean.TRUE.equals(timer.opt("coolingAlertHandled"))))) return null;
        return new Alert(id, end + coolingDuration(state, timer, brewing), phase);
    }

    static synchronized String restore(Context context) {
        String value = preferences(context).getString(SNAPSHOT, null);
        reconcile(context, null, snapshot(value), true);
        return value;
    }

    static synchronized boolean save(Context context, String value) {
        SharedPreferences storage = preferences(context);
        JSONObject previous = snapshot(storage.getString(SNAPSHOT, null));
        if (!storage.edit().putString(SNAPSHOT, value).commit()) return false;
        reconcile(context, previous, snapshot(value), false);
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
            deliver(context, intent.getStringExtra(TIMER_ID), phase, intent.getLongExtra(DEADLINE, -1), false);
        }
    }

    /**
     * The broadcast and the active WebView claim the same event. Only a foreground
     * WebView can use app audio when native notifications are unavailable.
     */
    static synchronized boolean deliver(Context context, String timerId, String phase, long scheduledAt, boolean allowWebAudio) {
        JSONObject saved = snapshot(preferences(context).getString(SNAPSHOT, null));
        Alert current = alert(saved, phase);
        long now = System.currentTimeMillis();
        if (current == null || !current.timerId.equals(timerId) || now < current.at
            || (scheduledAt != -1 && scheduledAt != current.at) || delivered(context, current)) return false;
        Alert cooling = alert(saved, COOLING);
        if (BREWING.equals(phase) && cooling != null && now >= cooling.at) return false;

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        boolean canNotify = manager.areNotificationsEnabled();
        if (canNotify && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = manager.getNotificationChannel(CHANNEL);
            canNotify = channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
        }
        if ((!canNotify && !allowWebAudio)
            || !preferences(context).edit().putString(deliveredKey(current), timerId).commit()) return false;
        cancel(context, phase);
        if (!canNotify) return true;

        try {
            notify(context, manager, current);
            return false;
        } catch (SecurityException ignored) {
            return allowWebAudio;
        }
    }

    private static void notify(Context context, NotificationManager manager, Alert alert) {
        Uri sound = Uri.parse("android.resource://" + context.getPackageName() + "/raw/notification");
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL,
                context.getString(R.string.tea_timer_alerts), NotificationManager.IMPORTANCE_HIGH);
            channel.setSound(sound, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).build());
            manager.createNotificationChannel(channel);
            builder = new Notification.Builder(context, CHANNEL);
        } else {
            builder = new Notification.Builder(context).setSound(sound).setPriority(Notification.PRIORITY_HIGH);
        }
        PendingIntent open = PendingIntent.getActivity(context, alert.code(), new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE);
        manager.notify(alert.code(), builder.setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(context.getString(R.string.app_name))
            .setContentText(context.getString(BREWING.equals(alert.phase) ? R.string.tea_timer_brew_done : R.string.tea_timer_cooling_done))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build());
    }
}
