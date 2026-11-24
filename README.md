<h1 align="center">Tea Timer · Tea Brewing Timer</h1>

<p align="center">
  <strong>A small timer for mindful tea drinking.</strong><br>
  Choose a time, brew your tea, and do not let it get cold.
</p>

<p align="center">
  <a href="https://hardd23.github.io/tea-timer/"><strong>App Website</strong></a>
  &nbsp;·&nbsp;
  <a href="https://my-tea-timer.vercel.app/"><strong>Open Timer</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/hardd23/tea-timer/releases/download/v1.3.2/Tea-Timer-1.3.2.apk"><strong>Download Tea Timer 1.3.2 for Android</strong></a>
</p>

<p align="center">
  <a href="https://hardd23.github.io/tea-timer/"><img src="https://img.shields.io/badge/Website-GitHub_Pages-327452?style=flat-square" alt="App website on GitHub Pages"></a>
  <a href="https://my-tea-timer.vercel.app/"><img src="https://img.shields.io/badge/Web--version-Open-2e7d32?style=flat-square" alt="Open the web version"></a>
  <a href="https://github.com/hardd23/tea-timer/releases/download/v1.3.2/Tea-Timer-1.3.2.apk"><img src="https://img.shields.io/badge/Android-APK-3ddc84?style=flat-square&amp;logo=android&amp;logoColor=white" alt="Download the Android APK"></a>
  <a href="#whats-new-in-132"><img src="https://img.shields.io/badge/Version-1.3.2-397b59?style=flat-square" alt="Version 1.3.2"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-5f6b61?style=flat-square" alt="MIT License"></a>
</p>

## Tea Timer Interface

The screenshots show Tea Timer 1.3.2 in dark mode.

<p align="center">
  <img src="./assets/readme/screenshots/tea-timer-idle.png" width="218" alt="Tea Timer — selecting minutes and seconds before starting">
  &nbsp;
  <img src="./assets/readme/screenshots/tea-timer-brewing.png" width="218" alt="Tea Timer — brewing countdown">
  &nbsp;
  <img src="./assets/readme/screenshots/tea-timer-cooling.png" width="218" alt="Tea Timer — cooling time and infusion counter">
</p>

<p align="center">
  <sub>Time selection · Brewing · Cooling after zero</sub>
</p>

<details>
  <summary><strong>More screens: tea sayings and settings</strong></summary>
  <br>
  <p align="center">
    <img src="./assets/readme/screenshots/tea-timer-wisdom.png" width="218" alt="Tea Timer — tea saying">
    &nbsp;
    <img src="./assets/readme/screenshots/tea-timer-settings.png" width="218" alt="Tea Timer — independent brewing and cooling sound settings">
  </p>
</details>

## Features

| | Feature |
| --- | --- |
| ⏳ | Minute and second wheels with gesture, mouse wheel, and keyboard controls; choose 5- or 10-second steps. |
| 🍵 | Brewing countdown followed by a cooling timer with softly pulsing digits and an optional alert after 1–5 minutes. |
| 🔔 | Independently preview, select, or mute the sounds for brewing and cooling. Android background notifications include the infusion number and brewing time. |
| 🔢 | Saved tea sessions with an infusion counter up to 99 and a prompt after a two-hour break when the timer is stopped. |
| 🌗 | Light and dark modes with three independently selectable accent palettes, remembered on the device. |
| RU / EN | Russian and English interfaces without reloading the page. |
| 💬 | 315 tea sayings in random order, with a 10-second reading pause. |
| ↻ | Android update checks and verified APK downloads through GitHub Releases. |

## What's New in 1.3.2

- Android shows one notification at a time when the app is in the background or the screen is locked. Returning to Tea Timer clears it.
- After a two-hour break, Tea Timer offers to continue the saved session or start a new one while keeping your selected brew duration and preferences.
- Brewing and cooling have distinct digit colors. Slightly smaller digits and a separate minus sign keep the reading centered. The negative countdown respects reduced motion.
- Four bowl and gong recordings can be previewed and selected separately for brewing and cooling. Either signal can be muted. Sounds are prepared in advance, and each timer alert replaces any audio already playing.

See the [bilingual changelog](./CHANGELOG.md) for the full release notes.

## How It Works

1. Select minutes and seconds on the vertical wheels and press “Start.”
2. During brewing, the timer border shows the countdown progress.
3. When brewing ends, the timer starts showing cooling time with a minus sign and the counter adds an infusion. A sound plays if enabled.
4. In Settings, choose the cooling delay and pick or mute either sound independently.
5. Select “Reset tea session” in Settings to start over.

Tea Timer uses the saved session and actual brew end time to restore the timer phase and infusion count when you reopen the app. On Android, allow notifications and alarms for alerts while the screen is locked.

## Open or Install

### App Website

[**Tea Timer on GitHub Pages**](https://hardd23.github.io/tea-timer/) — the project landing page with a feature overview, interface images, installation instructions, and links to the latest Android release and web version.

### Web Version

Open [my-tea-timer.vercel.app](https://my-tea-timer.vercel.app/) in a modern browser on your phone or computer.

### Android

Download [Tea-Timer-1.3.2.apk](https://github.com/hardd23/tea-timer/releases/download/v1.3.2/Tea-Timer-1.3.2.apk), open it on your Android device, and confirm the installation. Install the APK over an existing copy signed with the same certificate to keep data saved by that version. See [Releases](https://github.com/hardd23/tea-timer/releases) for other versions.

> Android may ask you to allow app installation from this source — this is a standard system message for APK files downloaded outside Google Play.

In Settings, choose “Check for updates” to find the latest stable release and download its verified APK from GitHub. Android may ask you to allow installation from Tea Timer and confirm the update. If a suitable APK cannot be verified, the app offers the release page instead.

## Tech Stack

- [Next.js](https://nextjs.org/) 16 · static export
- [React](https://react.dev/) 19 · [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Capacitor](https://capacitorjs.com/) 8 · Android
- [Vercel](https://vercel.com/) · web deployment
- [GitHub Pages](https://pages.github.com/) · project landing page

## Links

- [Tea Timer landing page](https://hardd23.github.io/tea-timer/)
- [Web version](https://my-tea-timer.vercel.app/)
- [Android releases](https://github.com/hardd23/tea-timer/releases)
- [Telegram @hardd23](https://t.me/hardd23)
- [GitHub repository](https://github.com/hardd23/tea-timer)
- [Buy the author tea](https://web.tribute.tg/d/OyG)

## License

The source code is distributed under the [MIT License](./LICENSE). See [NOTICE.md](./NOTICE.md) for visual materials and tea sayings, and [SOUND-CREDITS.md](./SOUND-CREDITS.md) for audio sources and licenses.
