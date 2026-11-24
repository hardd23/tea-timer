package lab.hardd.teatimer;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class TeaTimerNotificationTest {
    private Context context;
    private NotificationManager manager;

    @Before
    public void prepare() {
        var instrumentation = InstrumentationRegistry.getInstrumentation();
        context = new ContextWrapper(instrumentation.getTargetContext()) {
            @Override
            public SharedPreferences getSharedPreferences(String name, int mode) {
                return super.getSharedPreferences(name + "-test", mode);
            }
        };
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            instrumentation.getUiAutomation().grantRuntimePermission(context.getPackageName(), Manifest.permission.POST_NOTIFICATIONS);
        }
        manager = context.getSystemService(NotificationManager.class);
        TeaTimerAlerts.preferences(context).edit().clear().commit();
        TeaTimerAlerts.setActivityActive(context, false);
        TeaTimerAlerts.clearNotification(context);
    }

    @After
    public void cleanUp() {
        TeaTimerAudio.release();
        TeaTimerAlerts.save(context, "{\"schema\":1,\"sessionId\":null,\"timer\":null}");
        TeaTimerAlerts.clearNotification(context);
        TeaTimerAlerts.preferences(context).edit().clear().commit();
    }

    @Test
    public void backgroundNotificationsUseTheSameSlotAndKeepTheCompletedPourDetails() throws Exception {
        long end = System.currentTimeMillis() - 1000;
        JSONObject state = session("brew", end, "brewing", 2);
        JSONObject sounds = new JSONObject().put("brewing", "gong_clear").put("cooling", "singing_bowl");
        state.put("sounds", sounds);
        TeaTimerAlerts.setLanguage(context, "en");
        TeaTimerAlerts.save(context, state.toString());
        assertTrue(TeaTimerAlerts.deliver(context, "brew", "brewing", end));
        assertNotification("Pour #3 complete\nBrewing time: 1 min 30 sec", TimerSound.GONG_CLEAR);

        assertFalse(TeaTimerAlerts.deliver(context, "brew", "brewing", end));
        assertNotification("Pour #3 complete\nBrewing time: 1 min 30 sec", TimerSound.GONG_CLEAR);

        long elapsed = System.currentTimeMillis() - 61_000;
        // The wheels and editable counter are now different from the completed brew.
        JSONObject cooling = session("brew", elapsed, "cooling", 7);
        cooling.put("sounds", sounds);
        cooling.getJSONObject("timer").put("pourNumber", 3).put("coolingDurationMs", 60_000);
        TeaTimerAlerts.setLanguage(context, "ru");
        TeaTimerAlerts.save(context, cooling.toString());
        assertTrue(TeaTimerAlerts.deliver(context, "brew", "cooling", elapsed + 60_000));
        assertNotification("Пролив № 3 — остывание завершено\nВремя заваривания: 1 мин 30 сек", TimerSound.SINGING_BOWL);

        TeaTimerAlerts.clearNotification(context);
        awaitNotificationCount(0);
        assertFalse(TeaTimerAlerts.deliver(context, "brew", "cooling", elapsed + 60_000));
        awaitNotificationCount(0);
    }

    @Test
    public void mutedEventsStillPostNotificationsWithoutSoundOrDuplicates() throws Exception {
        TeaTimerAlerts.setLanguage(context, "en");
        JSONObject mute = new JSONObject().put("brewing", "silent").put("cooling", "silent");
        long end = System.currentTimeMillis() - 1000;
        JSONObject brewing = session("silent-brew", end, "brewing", 0).put("sounds", mute);
        TeaTimerAlerts.save(context, brewing.toString());
        assertTrue(TeaTimerAlerts.deliver(context, "silent-brew", "brewing", end));
        assertNotification("Pour #1 complete\nBrewing time: 1 min 30 sec", TimerSound.SILENT);
        assertFalse(TeaTimerAlerts.deliver(context, "silent-brew", "brewing", end));

        long elapsed = System.currentTimeMillis() - 61_000;
        JSONObject cooling = session("silent-brew", elapsed, "cooling", 1).put("sounds", mute);
        cooling.getJSONObject("timer").put("coolingDurationMs", 60_000);
        TeaTimerAlerts.save(context, cooling.toString());
        assertTrue(TeaTimerAlerts.deliver(context, "silent-brew", "cooling", elapsed + 60_000));
        assertNotification("Pour #1 — cooling complete\nBrewing time: 1 min 30 sec", TimerSound.SILENT);
        assertFalse(TeaTimerAlerts.deliver(context, "silent-brew", "cooling", elapsed + 60_000));
    }

    @Test
    public void resettingTheSessionCancelsPendingAlertsAndRejectsAnOldAlarm() throws Exception {
        long end = System.currentTimeMillis() + 90_000;
        TeaTimerAlerts.save(context, session("old-brew", end, "brewing", 2).toString());
        assertNotNull(pendingAlert("brewing", 6101));
        assertNotNull(pendingAlert("cooling", 6102));

        TeaTimerAlerts.save(context, "{\"schema\":1,\"sessionId\":null,\"timer\":null}");
        assertNull(pendingAlert("brewing", 6101));
        assertNull(pendingAlert("cooling", 6102));
        assertFalse(TeaTimerAlerts.deliver(context, "old-brew", "brewing", end));
        awaitNotificationCount(0);
    }

    @Test
    public void durationOmitsZeroMinutesAndSeconds() {
        var configuration = new android.content.res.Configuration(context.getResources().getConfiguration());
        configuration.setLocale(java.util.Locale.ENGLISH);
        Context english = context.createConfigurationContext(configuration);
        assertEquals("30 sec", TeaTimerAlerts.formatDuration(english, 30));
        assertEquals("2 min", TeaTimerAlerts.formatDuration(english, 120));
        assertEquals("1 min 30 sec", TeaTimerAlerts.formatDuration(english, 90));
    }

    @Test
    public void timerSoundPreemptsPreviewAndBlocksAnotherPreview() throws Exception {
        TeaTimerAudio.prepare(context);
        CountDownLatch interrupted = new CountDownLatch(1);
        TeaTimerAudio.playPreview(context, TimerSound.SINGING_BOWL, "first", interrupted::countDown);
        TeaTimerAudio.playAlert(context, TimerSound.GONG_SOFT);
        assertTrue(interrupted.await(1, TimeUnit.SECONDS));

        CountDownLatch blocked = new CountDownLatch(1);
        TeaTimerAudio.playPreview(context, TimerSound.DEFAULT, "second", blocked::countDown);
        assertTrue(blocked.await(1, TimeUnit.SECONDS));
    }

    private JSONObject session(String timerId, long endAt, String phase, int pourCount) throws Exception {
        JSONObject timer = new JSONObject().put("id", timerId).put("phase", phase)
            .put("duration", 90).put("endAt", endAt);
        return new JSONObject().put("schema", 1).put("sessionId", "test-session").put("pourCount", pourCount)
            .put("coolingDurationMinutes", 1).put("durationSeconds", 5).put("timer", timer);
    }

    private PendingIntent pendingAlert(String phase, int code) {
        return PendingIntent.getBroadcast(context, code, new Intent(context, TeaTimerAlerts.class).setAction(phase),
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
    }

    private void assertNotification(String expected, TimerSound sound) {
        long timeout = SystemClock.elapsedRealtime() + 3000;
        do {
            StatusBarNotification[] notifications = manager.getActiveNotifications();
            if (notifications.length == 1) {
                Notification notification = notifications[0].getNotification();
                if (expected.contentEquals(notification.extras.getString(Notification.EXTRA_BIG_TEXT, ""))) {
                    assertEquals("Tea Timer", notification.extras.getString(Notification.EXTRA_TITLE));
                    if (sound == TimerSound.SILENT) {
                        assertNull(notification.sound);
                        assertEquals(0, notification.defaults & Notification.DEFAULT_SOUND);
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        assertEquals(sound.channelId(), notification.getChannelId());
                        assertEquals(sound.uri(context), manager.getNotificationChannel(notification.getChannelId()).getSound());
                    } else {
                        assertEquals(sound.uri(context), notification.sound);
                    }
                    return;
                }
            }
            SystemClock.sleep(20);
        } while (SystemClock.elapsedRealtime() < timeout);
        throw new AssertionError("Expected exactly one notification with text: " + expected);
    }

    private void awaitNotificationCount(int expected) {
        long timeout = SystemClock.elapsedRealtime() + 3000;
        int count;
        do {
            count = manager.getActiveNotifications().length;
            if (count == expected) return;
            SystemClock.sleep(20);
        } while (SystemClock.elapsedRealtime() < timeout);
        assertEquals(expected, count);
    }
}
