package lab.hardd.teatimer;

import android.content.Intent;
import android.app.PendingIntent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.ref.WeakReference;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.net.ssl.HttpsURLConnection;

@CapacitorPlugin(name = "TeaUpdateInstaller")
public class TeaUpdateInstaller extends Plugin {
    private static final long MAX_SIZE = 100_000_000L;
    private final AtomicBoolean downloading = new AtomicBoolean(false);
    private final AtomicBoolean installing = new AtomicBoolean(false);
    private static WeakReference<TeaUpdateInstaller> activePlugin = new WeakReference<>(null);
    private static Intent pendingConfirmation;
    static final String PREFS = "tea-update-install";

    @Override
    public void load() { activePlugin = new WeakReference<>(this); }

    @Override
    protected void handleOnResume() {
        if (pendingConfirmation != null) getActivity().runOnUiThread(this::showConfirmation);
        String status = getContext().getSharedPreferences(PREFS, 0).getString("status", "idle");
        JSObject event = new JSObject(); event.put("status", status);
        notifyListeners("installStatus", event, true);
    }

    static void reportStatus(String status, Intent confirmation) {
        pendingConfirmation = confirmation;
        TeaUpdateInstaller plugin = activePlugin.get();
        if (plugin == null) return;
        JSObject event = new JSObject(); event.put("status", status);
        plugin.notifyListeners("installStatus", event, true);
        if (confirmation != null && plugin.getActivity().hasWindowFocus()) {
            plugin.getActivity().runOnUiThread(() -> plugin.showConfirmation());
        }
    }

    private void showConfirmation() {
        Intent intent = pendingConfirmation;
        if (intent == null) return;
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            pendingConfirmation = null;
        } catch (RuntimeException ignored) {
            // Keep the pending action so it can be retried when the app is foregrounded.
        }
    }

    private File apk() { return new File(getContext().getCacheDir(), "tea-timer-update.apk"); }

    @PluginMethod
    public void download(PluginCall call) {
        String source = call.getString("url", "");
        String hash = call.getString("sha256", "");
        Integer size = call.getInt("size", 0);
        Matcher name = Pattern.compile("https://github\\.com/hardd23/tea-timer/releases/download/v?([0-9]+\\.[0-9]+\\.[0-9]+)/Tea-Timer-\\1\\.apk").matcher(source);
        if (!name.matches()
            || !hash.matches("[a-f0-9]{64}") || size <= 0 || size > MAX_SIZE) {
            call.reject("Invalid update metadata"); return;
        }
        String expectedVersion = name.group(1);
        if (!downloading.compareAndSet(false, true)) { call.reject("Download already running"); return; }
        new Thread(() -> {
            File temp = new File(getContext().getCacheDir(), "tea-timer-update-part.apk");
            try {
                URL url = new URL(source);
                HttpsURLConnection connection = null;
                for (int i = 0; i < 5; i++) {
                    if (!url.getProtocol().equals("https") || url.getPort() != -1 || url.getUserInfo() != null
                        || !(url.getHost().equals("github.com") || url.getHost().equals("release-assets.githubusercontent.com")
                            || url.getHost().equals("objects.githubusercontent.com"))) throw new Exception("Untrusted download host");
                    connection = (HttpsURLConnection) url.openConnection();
                    connection.setInstanceFollowRedirects(false);
                    connection.setConnectTimeout(15_000);
                    connection.setReadTimeout(30_000);
                    int status = connection.getResponseCode();
                    if (status == 200) break;
                    if (status < 300 || status >= 400 || connection.getHeaderField("Location") == null) throw new Exception("Download failed");
                    url = new URL(url, connection.getHeaderField("Location"));
                    connection.disconnect();
                    connection = null;
                }
                if (connection == null || connection.getResponseCode() != 200) throw new Exception("Too many redirects");
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long total = 0;
                try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(temp)) {
                    byte[] buffer = new byte[16384]; int count;
                    while ((count = in.read(buffer)) != -1) {
                        total += count;
                        if (total > size || total > MAX_SIZE) throw new Exception("Unexpected file size");
                        digest.update(buffer, 0, count); out.write(buffer, 0, count);
                    }
                } finally { connection.disconnect(); }
                StringBuilder actual = new StringBuilder();
                for (byte b : digest.digest()) actual.append(String.format(java.util.Locale.ROOT, "%02x", b & 0xff));
                if (total != size || !actual.toString().equals(hash)) throw new Exception("APK checksum mismatch");
                verifyApk(temp, expectedVersion);
                if (apk().exists() && !apk().delete()) throw new Exception("Could not replace APK");
                if (!temp.renameTo(apk())) throw new Exception("Could not save APK");
                call.resolve();
            } catch (Exception e) { call.reject("Could not download or verify the update", e); }
            finally { temp.delete(); downloading.set(false); }
        }).start();
    }

    @SuppressWarnings("deprecation")
    private void verifyApk(File file, String expectedVersion) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo candidate = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        PackageInfo installed = pm.getPackageInfo(getContext().getPackageName(), flags);
        if (candidate == null || !getContext().getPackageName().equals(candidate.packageName)) throw new Exception("Wrong package");
        if (expectedVersion != null && !expectedVersion.equals(candidate.versionName)) throw new Exception("Wrong APK version");
        long newVersion = Build.VERSION.SDK_INT >= 28 ? candidate.getLongVersionCode() : candidate.versionCode;
        long oldVersion = Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode;
        if (newVersion <= oldVersion) throw new Exception("APK is not newer");
        Signature[] newSignatures = Build.VERSION.SDK_INT >= 28 && candidate.signingInfo != null
            ? candidate.signingInfo.getApkContentsSigners() : candidate.signatures;
        Signature[] oldSignatures = Build.VERSION.SDK_INT >= 28 && installed.signingInfo != null
            ? installed.signingInfo.getApkContentsSigners() : installed.signatures;
        if (newSignatures == null || oldSignatures == null || newSignatures.length != 1 || oldSignatures.length != 1
            || !Arrays.equals(newSignatures[0].toByteArray(), oldSignatures[0].toByteArray())) throw new Exception("APK signature mismatch");
    }

    private void openInstaller(PluginCall call) {
        if (!installing.compareAndSet(false, true)) { call.reject("Installation already starting"); return; }
        new Thread(() -> {
            PackageInstaller installer = getContext().getPackageManager().getPackageInstaller();
            int sessionId = -1;
            try {
                verifyApk(apk(), null);
                PackageInfo candidate = getContext().getPackageManager().getPackageArchiveInfo(apk().getAbsolutePath(), 0);
                long targetVersion = Build.VERSION.SDK_INT >= 28 ? candidate.getLongVersionCode() : candidate.versionCode;
                PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                params.setAppPackageName(getContext().getPackageName());
                params.setSize(apk().length());
                if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
                sessionId = installer.createSession(params);
                try (PackageInstaller.Session session = installer.openSession(sessionId);
                     InputStream input = new FileInputStream(apk());
                     OutputStream output = session.openWrite("base.apk", 0, apk().length())) {
                    byte[] buffer = new byte[16384]; int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    session.fsync(output);
                }
                getContext().getSharedPreferences(PREFS, 0).edit().putInt("session", sessionId)
                    .putLong("targetVersion", targetVersion).putString("status", "installing").apply();
                Intent callback = new Intent(getContext(), UpdateInstallReceiver.class);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
                PendingIntent pending = PendingIntent.getBroadcast(getContext(), sessionId, callback, flags);
                try (PackageInstaller.Session session = installer.openSession(sessionId)) {
                    session.commit(pending.getIntentSender());
                }
                JSObject result = new JSObject(); result.put("status", "installing"); call.resolve(result);
            } catch (Exception e) {
                if (sessionId >= 0) try { installer.abandonSession(sessionId); } catch (Exception ignored) {}
                getContext().getSharedPreferences(PREFS, 0).edit().putString("status", "failed").apply();
                call.reject("Could not start installation", e);
            } finally { installing.set(false); }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            JSObject result = new JSObject(); result.put("status", "permissionRequired"); call.resolve(result); return;
        }
        openInstaller(call);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls()) { openInstaller(call); return; }
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
        startActivityForResult(call, intent, "permissionResult");
    }

    @ActivityCallback
    private void permissionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls()) openInstaller(call);
        else { JSObject response = new JSObject(); response.put("status", "permissionRequired"); call.resolve(response); }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        android.content.SharedPreferences prefs = getContext().getSharedPreferences(PREFS, 0);
        String status = prefs.getString("status", "idle");
        try {
            PackageInfo installed = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            long version = Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode;
            if (prefs.getLong("targetVersion", Long.MAX_VALUE) <= version) {
                status = "success";
                prefs.edit().putString("status", status).remove("targetVersion").apply();
            }
        } catch (PackageManager.NameNotFoundException ignored) {}
        if ((status.equals("installing") || status.equals("confirmationRequired"))
            && getContext().getPackageManager().getPackageInstaller().getSessionInfo(prefs.getInt("session", -1)) == null) {
            status = "failed";
            prefs.edit().putString("status", status).apply();
        }
        JSObject result = new JSObject(); result.put("status", status); call.resolve(result);
    }

    @PluginMethod
    public void continueInstall(PluginCall call) {
        if (pendingConfirmation != null) {
            showConfirmation();
            JSObject result = new JSObject(); result.put("status", "confirmationRequired"); call.resolve(result);
            return;
        }
        int oldSession = getContext().getSharedPreferences(PREFS, 0).getInt("session", -1);
        if (oldSession >= 0) {
            try { getContext().getPackageManager().getPackageInstaller().abandonSession(oldSession); } catch (Exception ignored) {}
        }
        openInstaller(call);
    }
}
