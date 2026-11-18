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
  <a href="https://github.com/hardd23/tea-timer/releases/latest"><strong>Download for Android</strong></a>
</p>

<p align="center">
  <a href="https://hardd23.github.io/tea-timer/"><img src="https://img.shields.io/badge/Website-GitHub_Pages-327452?style=flat-square" alt="App website on GitHub Pages"></a>
  <a href="https://my-tea-timer.vercel.app/"><img src="https://img.shields.io/badge/Web--version-Open-2e7d32?style=flat-square" alt="Open the web version"></a>
  <a href="https://github.com/hardd23/tea-timer/releases/latest"><img src="https://img.shields.io/badge/Android-APK-3ddc84?style=flat-square&amp;logo=android&amp;logoColor=white" alt="Download the Android APK"></a>
  <a href="#whats-new-in-130"><img src="https://img.shields.io/badge/Version-1.3.0-397b59?style=flat-square" alt="Version 1.3.0"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-5f6b61?style=flat-square" alt="MIT License"></a>
</p>

## Tea Timer Interface

The screenshots show Tea Timer 1.3.0 in dark mode.

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
    <img src="./assets/readme/screenshots/tea-timer-settings.png" width="218" alt="Tea Timer — theme, language, cooling alert, and infusion settings">
  </p>
</details>

## Features

| | Feature |
| --- | --- |
| ⏳ | Minute and second wheels with gesture, mouse wheel, and keyboard controls; choose 5- or 10-second steps. |
| 🍵 | Brewing countdown followed by a cooling timer, with a brewing signal and an optional second alert after 1–5 minutes. |
| 🔢 | Infusion counter with automatic tracking and manual adjustment in settings — up to 99. |
| 🌗 | Light and dark modes with three independently selectable accent palettes, remembered on the device. |
| RU / EN | Russian and English interfaces without reloading the page. |
| 💬 | 315 tea sayings in random order, with a 10-second reading pause. |
| ↻ | Android update checks and verified APK downloads through GitHub Releases. |

## What's New in 1.3.0

- Set the cooling alert to sound after 1–5 minutes or turn it off while the cooling timer keeps running.
- Larger wheel digits, minute and second marks inside the frames, and matching regular-weight digits during brewing and cooling.
- Neutral timer digits in every theme, a header mark that matches the Start button, and a simpler adaptive Android icon.
- The timer phase and infusion count are saved as part of the tea session.

The download link above points to the latest published release.

## How It Works

1. Select minutes and seconds on the vertical wheels and press “Start.”
2. During brewing, the timer border shows the countdown progress.
3. When brewing ends, the first signal sounds, the timer displays cooling time with a minus sign, and the counter adds an infusion.
4. Use Settings to choose the cooling duration or turn the second signal off.
5. Select “Reset tea session” in Settings to start over.

Tea Timer uses the saved session and actual brew end time to restore the timer phase and infusion count when you reopen the app. On Android, allow notifications and alarms for alerts while the screen is locked.

## Open or Install

### App Website

[**Tea Timer on GitHub Pages**](https://hardd23.github.io/tea-timer/) — the project landing page with a feature overview, interface images, installation instructions, and links to the latest Android release and web version.

### Web Version

Open [my-tea-timer.vercel.app](https://my-tea-timer.vercel.app/) in a modern browser on your phone or computer.

### Android

Download the latest `Tea-Timer-*.apk` file from the [Releases](https://github.com/hardd23/tea-timer/releases/latest) page, open it on your Android device, and confirm the installation. Install the APK over an existing copy signed with the same certificate to keep data saved by that version.

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

The source code is distributed under the [MIT License](./LICENSE). Attribution for visual materials and tea sayings is provided in [NOTICE.md](./NOTICE.md).
