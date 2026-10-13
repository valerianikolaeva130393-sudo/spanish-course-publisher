# Автоматическая публикация курса «Испанский через истории»

Репозиторий публикует четыре сезона курса в Telegram через GitHub Actions — без Python и отдельного сервера.

## Расписание

- 07:00 по часовому поясу `Europe/Moscow` — утренний урок и аудио.
- 14:00 — дневная практика, аудио и Telegram Poll.
- В дни 7, 14, 21 и 28 перед утренним уроком публикуется недельное изображение.
- После Дня 30 публикуются 6 итоговых Poll и финальное поздравление.
- `data/state.json` защищает канал от повторной отправки уже опубликованных материалов.

## Сезон 4

- публикации: `data/lessons-season4.json`;
- аудиоманифест: `data/audio_manifest-season4.json`;
- 30 утренних MP3: `audio/season4/morning/`;
- 30 дневных MP3: `audio/season4/practice/`;
- изображения недель и финала: `images/season4/`.

Сезон выбирается автоматически по месяцу относительно переменной `START_DATE`. Для ручной проверки можно выбрать сезон 4 в workflow `Preview Spanish Course`.

## Обязательные настройки GitHub

### Secrets

- `BOT_TOKEN` — токен Telegram-бота;
- `CHANNEL_ID` — основной канал;
- `TEST_TELEGRAM_CHAT_ID` — тестовый канал.

### Variables

- `START_DATE` — дата первого урока первого сезона в формате `YYYY-MM-DD`;
- `TIMEZONE` — `Europe/Moscow`.

В **Settings → Actions → General → Workflow permissions** должны быть включены **Read and write permissions**.

## Проверка

1. Откройте **Actions → Publish Spanish course → Run workflow**.
2. Выберите `slot: check`.
3. После зелёной галочки откройте **Preview Spanish Course**.
4. Проверьте сезон 4: утро Дня 1, практику Дня 1, фото Дня 7 и финальное поздравление.

Подробная пошаговая инструкция находится в `UPLOAD_INSTRUCTION_RU.md`.
