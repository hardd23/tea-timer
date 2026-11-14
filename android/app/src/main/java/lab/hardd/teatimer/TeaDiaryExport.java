package lab.hardd.teatimer;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.util.UUID;

@CapacitorPlugin(name = "TeaDiaryExport")
public class TeaDiaryExport extends Plugin {
    private File file;
    private FileOutputStream output;
    private String mime;

    @PluginMethod
    public synchronized void begin(PluginCall call) {
        String name = call.getString("name", "");
        if (!(name.equals("tea-timer-history.csv") || name.equals("tea-timer-history.json"))) { call.reject("Invalid filename"); return; }
        if (output != null) { call.reject("Export already in progress"); return; }
        try {
            File directory = new File(getContext().getCacheDir(), "diary-export/" + UUID.randomUUID());
            if (!directory.mkdirs()) throw new Exception("Could not create export directory");
            file = new File(directory, name);
            output = new FileOutputStream(file);
            mime = name.endsWith(".csv") ? "text/csv" : "application/json";
            call.resolve();
        } catch (Exception e) { output = null; file = null; call.reject("Could not create export", e); }
    }

    @PluginMethod
    public synchronized void append(PluginCall call) {
        String data = call.getString("data", "");
        if (output == null || data.length() > 32768) { call.reject("Invalid export chunk"); return; }
        try { output.write(Base64.decode(data, Base64.DEFAULT)); call.resolve(); }
        catch (Exception e) { closeOutput(); call.reject("Could not write export", e); }
    }

    @PluginMethod
    public synchronized void share(PluginCall call) {
        if (output == null || file == null) { call.reject("No export available"); return; }
        try {
            output.flush(); output.getFD().sync(); output.close(); output = null;
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.setClipData(ClipData.newRawUri("Tea Timer", uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().runOnUiThread(() -> {
                try { getActivity().startActivity(Intent.createChooser(send, "Tea Timer")); call.resolve(); }
                catch (Exception e) { call.reject("Could not share export", e); }
            });
            file = null;
        } catch (Exception e) { closeOutput(); call.reject("Could not finish export", e); }
    }

    private void closeOutput() {
        try { if (output != null) output.close(); } catch (Exception ignored) {}
        output = null;
        file = null;
    }

    @PluginMethod
    public synchronized void abort(PluginCall call) { closeOutput(); call.resolve(); }

    @Override
    protected synchronized void handleOnDestroy() { closeOutput(); }
}
