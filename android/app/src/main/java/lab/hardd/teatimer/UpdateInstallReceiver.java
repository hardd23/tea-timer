package lab.hardd.teatimer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.os.Build;

public class UpdateInstallReceiver extends BroadcastReceiver {
    @Override
    @SuppressWarnings("deprecation")
    public void onReceive(Context context, Intent intent) {
        SharedPreferences prefs = context.getSharedPreferences(TeaUpdateInstaller.PREFS, 0);
        int session = intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1);
        if (session < 0 || session != prefs.getInt("session", -2)) return;
        int code = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        Intent confirmation = null;
        String status;
        if (code == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            confirmation = Build.VERSION.SDK_INT >= 33
                ? intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class)
                : intent.getParcelableExtra(Intent.EXTRA_INTENT);
            status = confirmation == null ? "failed" : "confirmationRequired";
        } else {
            status = code == PackageInstaller.STATUS_SUCCESS ? "success" : "failed";
        }
        prefs.edit().putString("status", status).apply();
        TeaUpdateInstaller.reportStatus(status, confirmation);
    }
}
