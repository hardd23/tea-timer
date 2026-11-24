package lab.hardd.teatimer;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    private boolean resumed;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TeaUpdateInstaller.class);
        registerPlugin(TeaSessionStorage.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        resumed = true;
        TeaTimerAlerts.setActivityActive(this, true);
        super.onResume();
    }

    @Override
    public void onPause() {
        resumed = false;
        TeaTimerAlerts.setActivityActive(this, false);
        super.onPause();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && resumed) TeaTimerAlerts.setActivityActive(this, true);
    }

    @Override
    public void onTopResumedActivityChanged(boolean isTopResumedActivity) {
        super.onTopResumedActivityChanged(isTopResumedActivity);
        TeaTimerAlerts.setActivityActive(this, resumed && isTopResumedActivity);
    }

    @Override
    public void onDestroy() {
        if (isFinishing()) {
            TeaTimerAlerts.clearNotification(this);
            TeaTimerAudio.release();
        }
        super.onDestroy();
    }
}
