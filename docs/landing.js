const STORAGE_KEY = "tea-timer-landing-language";

const translations = {
  "Перейти к содержанию": "Skip to content",
  "Чайный": "Tea",
  "таймер": "Timer",
  "Скриншоты": "Screenshots",
  "Возможности": "Features",
  "Как установить": "How to install",
  "Скачать APK": "Download APK",
  "Искусство": "The art of",
  "не спешить.": "taking your time.",
  "Заваривайте чай в своём ритме. Tea Timer бережно отсчитывает секунды, следит за остыванием и помнит каждый пролив, чтобы вы могли наслаждаться моментом.":
    "Brew tea at your own pace. Tea Timer carefully counts the seconds, tracks cooling, and remembers every infusion so you can enjoy the moment.",
  "Скачать для Android": "Download for Android",
  "Открыть веб-версию": "Open the web version",
  "Бесплатно": "Free",
  "APK для Android": "APK for Android",
  "Открытый исходный код": "Open source",
  "Точное время": "Precise timing",
  "Минуты и секунды": "Minutes and seconds",
  "Чайный ритуал": "Tea ritual",
  "Без суеты и спешки": "Calm and unhurried",
  "Экран Tea Timer 1.3.0": "Tea Timer 1.3.0",
  "Кнопка загрузки ведёт к последнему опубликованному релизу.":
    "The download button points to the latest published release.",
  "Экраны Tea Timer 1.3.0 в тёмном режиме.":
    "Tea Timer 1.3.0 in dark mode.",
  "Три цветовые темы для каждого режима — чайный лист, янтарь и слива.": "Choose tea leaf, amber, or plum in either mode.",
  "Шаг 5 или 10 секунд. При прокрутке через ноль меняется и минута.": "Choose 5- or 10-second steps. Scrolling past zero adjusts the minutes.",
  "Приложение проверит и загрузит обновление. Установку можно подтвердить в Android.":
    "The app checks for and downloads updates. Confirm installation in Android.",
  "Заваривание и остывание": "Brewing and cooling",
  "До 99 проливов": "Up to 99 infusions",
  "315 чайных мыслей": "315 tea thoughts",
  "Маленькие вещи делают чаепитие особенным.": "Small details make tea time special.",
  "Минималистичный инструмент, в котором всё подчинено одному: сохранить ощущение момента, пока чай раскрывает свой вкус.":
    "A minimalist tool designed around one goal: preserving the feeling of the moment while the tea reveals its flavor.",
  "01 / Ритм": "01 / Rhythm",
  "От первого мгновения до последней капли.": "From the first moment to the last drop.",
  "Первый сигнал прозвучит в конце заваривания. Затем таймер покажет, сколько чай остывает. В настройках можно включить второй сигнал через 1–5 минут.":
    "The first sound marks the end of brewing. The timer then shows how long the tea has been cooling. You can set a second alert after 1–5 minutes.",
  "Заваривание": "Brewing",
  "Старт": "Start",
  "Готово: 00:00": "Ready: 00:00",
  "Остывание": "Cooling",
  "После нуля": "After zero",
  "02 / Проливы": "02 / Infusions",
  "Ничего не теряется.": "Nothing gets lost.",
  "Автоматический счётчик проливов с ручной корректировкой. На Android чаепитие восстанавливается после сворачивания приложения.":
    "An automatic infusion counter with manual adjustment. On Android, the tea session resumes when you return to the app.",
  "03 / Настроение": "03 / Mood",
  "Мудрость в паузах.": "Wisdom in the pauses.",
  "315 чайных высказываний, которые помогают на мгновение остановиться.":
    "315 tea sayings that help you pause for a moment.",
  "315 чайных высказываний в полноэкранном режиме. На чтение каждой фразы есть 10 секунд до смены.":
    "315 full-screen tea sayings, with a 10-second reading pause before you can move on.",
  "Один ритуал.": "One ritual.",
  "Каждое мгновение.": "Every moment.",
  "01 / Заваривание": "01 / Brewing",
  "Время под контролем.": "Timing under control.",
  "Обратный отсчёт помогает поймать нужный момент.":
    "The countdown helps you catch the right moment.",
  "02 / После нуля": "02 / After zero",
  "Ритм продолжается.": "The rhythm continues.",
  "Время после завершения и число проливов остаются на виду.":
    "Elapsed time after brewing and the infusion count remain visible.",
  "03 / Пауза": "03 / Pause",
  "Немного мудрости.": "A little wisdom.",
  "Чайные мысли для небольшого перерыва.": "Tea thoughts for a short break.",
  "04 / Ваш выбор": "04 / Your choice",
  "Только необходимое.": "Only what you need.",
  "Настройте сигнал и время остывания, тему, язык и счётчик проливов.":
    "Set the cooling alert, cooling duration, theme, language, and infusion count.",
  "Понравилось? Попробуйте таймер в своём ритме.":
    "Like what you see? Try the timer at your own pace.",
  "Всё нужное.": "Everything you need.",
  "И ничего лишнего.": "Nothing you do not.",
  "Выберите время привычным движением, переключите тему под вечернее настроение или смените язык. Настройки останутся с вами.":
    "Set the time with a familiar gesture, switch the theme to suit the evening, or change the language. Your settings stay with you.",
  "Выберите время на барабанах. В настройках меняются цветовая тема, язык, шаг таймера и время до сигнала остывания.":
    "Set the time with the wheels. In Settings, choose a color theme, language, timer step, and when the cooling alert sounds.",
  "Светлая и тёмная темы": "Light and dark themes",
  "Под настроение и освещение.": "For any mood and lighting.",
  "Два языка": "Two languages",
  "Русский и английский без перезагрузки.": "Russian and English without reloading.",
  "Точная настройка": "Precise control",
  "Отдельные барабаны минут и секунд.": "Separate minute and second wheels.",
  "Актуальные версии": "Up-to-date versions",
  "Проверка Android-обновлений через GitHub.": "Android update checks through GitHub.",
  "Три шага, и чай готов.": "Three steps, and your tea is ready.",
  "Tea Timer бесплатно распространяется через GitHub Releases. Для установки не нужен аккаунт в магазине приложений.":
    "Tea Timer is distributed for free through GitHub Releases. You do not need an app store account to install it.",
  "Скачайте файл": "Download the file",
  "Перейдите к последнему релизу и найдите в разделе Assets файл":
    "Open the latest release and find the file in the Assets section:",
  "Разрешите установку": "Allow installation",
  "Откройте APK. Android может попросить разрешить установку приложения из этого источника.":
    "Open the APK. Android may ask you to allow app installation from this source.",
  "Начните чаепитие": "Start your tea session",
  "Запустите таймер и выберите время. Проверка новых версий доступна из меню приложения.":
    "Launch the timer and choose a duration. You can check for new versions from the app menu.",
  "Перейти к APK": "Go to the APK",
  "Или откройте таймер в браузере": "Or open the timer in your browser",
  "Немного внимания ко времени, и обычное чаепитие становится маленьким ритуалом.":
    "A little attention to time turns an ordinary cup of tea into a small ritual.",
  "Tea Timer, независимый проект": "Tea Timer, an independent project",
  "Открытый исходный код, MIT": "Open source, MIT",
  "Все релизы": "All releases",
  "Угостить чаем": "Buy me tea",
};

const attributeTranslations = {
  "Основная навигация": "Main navigation",
  "Чайный таймер Tea Timer: наверх": "Tea Timer: back to top",
  "Выбор языка": "Language selection",
  "Русский": "Russian",
  "Английский": "English",
  "Экран выбора времени Tea Timer": "Tea Timer time selection screen",
  "Барабаны минут и секунд, кнопка «Старт» и счётчик проливов в Tea Timer":
    "Minute and second wheels, Start button, and infusion counter in Tea Timer",
  "Схема двух фаз таймера: заваривание, затем остывание":
    "Diagram of the timer's two phases: brewing, then cooling",
  "Обратный отсчёт во время заваривания в Tea Timer":
    "Brewing countdown in Tea Timer",
  "Время остывания со знаком минус и счётчик проливов в Tea Timer":
    "Cooling time marked with a minus sign and infusion counter in Tea Timer",
  "Полноэкранное чайное высказывание в Tea Timer":
    "Full-screen tea saying in Tea Timer",
  "Настройки темы, языка, сигнала остывания и числа проливов в Tea Timer":
    "Theme, language, cooling alert, and infusion settings in Tea Timer",
  "О проекте": "About the project",
};

const pageMetadata = {
  ru: {
    title: "Tea Timer: искусство не спешить",
    description:
      "Бесплатный чайный таймер для Android и браузера. Отсчёт заваривания, настраиваемый сигнал остывания и счётчик проливов.",
    ogTitle: "Tea Timer: искусство не спешить",
    ogDescription:
      "Tea Timer для Android и браузера. Заваривайте чай по таймеру, настройте сигнал остывания и следите за числом проливов.",
  },
  en: {
    title: "Tea Timer: the art of taking your time",
    description:
      "Free tea timer for Android and the web, with a brewing countdown, a customizable cooling alert, and an infusion counter.",
    ogTitle: "Tea Timer: the art of taking your time",
    ogDescription:
      "Tea Timer for Android and the web. Time your brew, set a cooling alert, and keep track of infusions.",
  },
};

const textNodes = [];
const attributeNodes = [];

function rememberTranslatableContent() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const source = node.nodeValue.trim();

    if (translations[source]) {
      textNodes.push({ node, source, original: node.nodeValue });
    }
  }

  document.querySelectorAll("[aria-label], [alt]").forEach((element) => {
    ["aria-label", "alt"].forEach((attribute) => {
      const source = element.getAttribute(attribute);

      if (source && attributeTranslations[source]) {
        attributeNodes.push({ element, attribute, source });
      }
    });
  });
}

function replaceTextNode(entry, language) {
  if (language === "ru") {
    entry.node.nodeValue = entry.original;
    return;
  }

  entry.node.nodeValue = entry.original.replace(
    entry.source,
    translations[entry.source],
  );
}

function updateMetadata(language) {
  const metadata = pageMetadata[language];
  const description = document.querySelector('meta[name="description"]');
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDescription = document.querySelector(
    'meta[property="og:description"]',
  );

  document.title = metadata.title;
  description?.setAttribute("content", metadata.description);
  ogTitle?.setAttribute("content", metadata.ogTitle);
  ogDescription?.setAttribute("content", metadata.ogDescription);
}

function saveLanguage(language) {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // The page remains usable when storage is unavailable.
  }
}

function loadLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ru";
  } catch {
    return "ru";
  }
}

function applyLanguage(language, persist = true) {
  document.documentElement.lang = language;
  textNodes.forEach((entry) => replaceTextNode(entry, language));
  attributeNodes.forEach(({ element, attribute, source }) => {
    element.setAttribute(
      attribute,
      language === "en" ? attributeTranslations[source] : source,
    );
  });
  updateMetadata(language);

  document.querySelectorAll("[data-language]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.language === language),
    );
  });

  if (persist) {
    saveLanguage(language);
  }
}

rememberTranslatableContent();

document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => applyLanguage(button.dataset.language));
});

applyLanguage(loadLanguage(), false);
