package lab.hardd.teatimer;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TeaUpdateInstaller.class);
        super.onCreate(savedInstanceState);
    }
}
