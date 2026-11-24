# Tea Timer sound credits

| ID | Recording | Source | License |
| --- | --- | --- | --- |
| `default` | Original Tea Timer signal | `public/notification.mp3`, introduced in repository commit `c187602` | The repository and source file contain no separate audio attribution or license metadata. |
| `gong_clear` | Gong_Center_Clear.wav by Q.K. | [Freesound 56240](https://freesound.org/people/Q.K./sounds/56240/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `gong_soft` | Instrument_gong_soft.aif by vrodge | [Freesound 119545](https://freesound.org/people/vrodge/sounds/119545/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `singing_bowl` | Singing bowl – single strike 6 by s-light | [Freesound 411486](https://freesound.org/people/s-light/sounds/411486/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

The app uses stereo MP3 at 44.1 kHz. The initial gain adjustments targeted approximately −24 LUFS integrated. The long gong was then reduced by 5 dB to match the short bowl at −20.8 LUFS maximum momentary loudness (400 ms). Leading silence was trimmed where present and the tails were faded. The 49-second singing bowl recording was shortened to an 18-second version with a five-second fade at the end.

The web build serves the three new recordings from `public/sounds/raw/`. Gradle also uses that directory as the source of the new Android raw audio resources. The retained default signal uses its existing path on each platform.
