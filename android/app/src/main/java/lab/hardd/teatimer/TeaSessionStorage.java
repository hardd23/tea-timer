package lab.hardd.teatimer;

import android.Manifest;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONObject;

@CapacitorPlugin(name = "TeaSessionStorage", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class TeaSessionStorage extends Plugin {
    @PluginMethod
    public void read(PluginCall call) {
        TeaTimerAudio.prepare(getContext());
        String value = TeaTimerAlerts.restore(getContext());
        JSObject result = new JSObject();
        result.put("value", value == null ? JSONObject.NULL : value);
        call.resolve(result);
    }

    @PluginMethod
    public void write(PluginCall call) {
        String value = call.getString("value");
        if (value == null) {
            call.reject("Tea session snapshot is missing");
            return;
        }
        if (!TeaTimerAlerts.save(getContext(), value)) {
            call.reject("Could not save tea session");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void requestAlerts(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState("notifications") != PermissionState.GRANTED
            && !TeaTimerAlerts.preferences(getContext()).getBoolean("asked_notifications", false)) {
            TeaTimerAlerts.preferences(getContext()).edit().putBoolean("asked_notifications", true).apply();
            requestPermissionForAlias("notifications", call, "alertsPermissionResult");
        } else call.resolve();
    }

    @PermissionCallback
    private void alertsPermissionResult(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void setAlertLanguage(PluginCall call) {
        TeaTimerAlerts.setLanguage(getContext(), call.getString("language"));
        call.resolve();
    }

    @PluginMethod
    public void signal(PluginCall call) {
        TeaTimerAlerts.deliver(getContext(), call.getString("timerId"), call.getString("phase"), -1);
        call.resolve();
    }

    @PluginMethod
    public void preview(PluginCall call) {
        String token = call.getString("token");
        if (token == null) {
            call.reject("Preview token is missing");
            return;
        }
        TeaTimerAlerts.preview(getContext(), TimerSound.fromId(call.getString("soundId")), token, call::resolve);
    }

    @PluginMethod
    public void stopPreview(PluginCall call) {
        String token = call.getString("token");
        if (token != null) TeaTimerAudio.stopPreview(token);
        call.resolve();
    }
}
