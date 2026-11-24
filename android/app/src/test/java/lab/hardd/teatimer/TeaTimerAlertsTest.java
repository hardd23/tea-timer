package lab.hardd.teatimer;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class TeaTimerAlertsTest {
    @Test
    public void soundChannelIdsAreStableAndLegacyPreferencesUseTheOriginalChannel() {
        assertEquals("tea-timer-alerts", TimerSound.fromId(null).channelId());
        assertEquals(TimerSound.DEFAULT, TimerSound.fromId("unknown"));
        assertEquals("tea-timer-alerts-gong_clear", TimerSound.fromId("gong_clear").channelId());
        assertEquals("tea-timer-alerts-gong_soft", TimerSound.fromId("gong_soft").channelId());
        assertEquals("tea-timer-alerts-singing_bowl", TimerSound.fromId("singing_bowl").channelId());
        assertEquals("tea-timer-alerts-silent", TimerSound.fromId("silent").channelId());
        assertEquals(TimerSound.SILENT, TimerSound.SILENT.available(null));
    }

    @Test
    public void foregroundWithUnlockedScreenPlaysOnlyTheSound() {
        assertFalse(TeaTimerAlerts.shouldPostNotification(true, true, false));
    }

    @Test
    public void backgroundOrCoveredActivityPostsNotification() {
        assertTrue(TeaTimerAlerts.shouldPostNotification(false, true, false));
    }

    @Test
    public void lockedOrSleepingScreenPostsNotificationEvenBeforeTheActivityPauses() {
        assertTrue(TeaTimerAlerts.shouldPostNotification(true, true, true));
        assertTrue(TeaTimerAlerts.shouldPostNotification(true, false, false));
    }
}
