# Changelog

## 1.3.2

### Русский

- Android показывает уведомления о заваривании и остывании в фоне и при заблокированном экране. В уведомлении указаны номер пролива и время заваривания. Новое уведомление заменяет предыдущее, а возврат в приложение очищает его.
- Если после последнего пролива прошло два часа и таймер остановлен, при возвращении Tea Timer предлагает продолжить текущее чаепитие или начать новое. При начале нового чаепития выбранное время и настройки сохраняются.
- Заваривание и остывание различаются по цвету цифр. Цифры стали на 2 px меньше. Знак минуса отделён от цифр, поэтому они остаются по центру. Отрицательный отсчёт плавно мерцает с учётом системной настройки уменьшенного движения.
- Для окончания заваривания и остывания можно независимо выбрать чашу, гонг или «Без звука». В меню доступны предпрослушивание и четыре записи. Громкость длинного гонга согласована с короткой чашей.
- Звуки подготавливаются заранее. Сигналы таймера прерывают предпрослушивание, а каждый новый сигнал заменяет предыдущий. Тихий режим сохраняет визуальную индикацию и фоновые уведомления.

### English

- Android shows brewing and cooling notifications in the background and on the lock screen. Each includes the infusion number and brewing time. A new notification replaces the previous one, and returning to the app clears it.
- After a two-hour break, Tea Timer offers to continue or start a new tea session when you return with the timer stopped. Starting a new session keeps the selected brew duration and preferences.
- Brewing and cooling use different digit colors. The digits are 2 px smaller, and the minus sign has its own spacing so the digits stay centered. The negative countdown pulses gently and respects reduced motion.
- Choose a bowl, a gong, or No sound independently for brewing and cooling. Preview any of the four recordings in Settings. The Long Gong is balanced against the Short Bowl.
- Sounds are prepared in advance. Timer alerts interrupt previews, and each new alert replaces the previous one. No sound keeps visual feedback and background notifications available.

## 1.3.1

- Android update checks can fall back to the public GitHub Releases page when the GitHub API is unavailable.

## 1.3.0

- Added configurable cooling alerts, three accent palettes, and saved tea sessions.
