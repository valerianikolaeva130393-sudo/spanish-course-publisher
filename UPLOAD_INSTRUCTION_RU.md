# Обновление репозитория «Испанский через истории» — Сезон 4

Комплект добавляет четвёртый сезон и сохраняет без изменений материалы сезонов 1–3 и текущее состояние публикаций.

## Что добавлено и обновлено

- `audio/season4/morning/day01.mp3` … `day30.mp3` — 30 утренних аудио;
- `audio/season4/practice/day01.mp3` … `day30.mp3` — 30 дневных аудио;
- `images/season4/day07.jpg`, `day14.jpg`, `day21.jpg`, `day28.jpg` — четыре недельных изображения;
- `images/season4/season4-congratulations.jpg` — финальное изображение;
- `data/lessons-season4.json` — 30 утренних и 30 дневных публикаций, 30 ежедневных Poll и 6 итоговых Poll;
- `data/audio_manifest-season4.json` — проверочный манифест всех 60 аудио;
- `src/publish.mjs` и `src/check-files.mjs` — поддержка сезона 4;
- `.github/workflows/preview.yml` — выбор сезона 4 в тестовом запуске;
- `.github/workflows/repair-audio.yml` — выбор сезона при восстановлении совместимости MP3.

## Как загрузить через сайт GitHub

1. Скачайте и распакуйте архив `Spanish_Season4_GitHub_REPLACE.zip`.
2. Откройте ваш репозиторий `spanish-course-publisher` на GitHub.
3. Перейдите в корень репозитория, где видны `.github`, `audio`, `data`, `images` и `src`.
4. Нажмите **Add file → Upload files**.
5. Перетащите в окно содержимое распакованного архива: `.github`, `audio`, `data`, `images`, `src`, `README.md` и `UPLOAD_INSTRUCTION_RU.md`.
6. Проверьте, что GitHub показывает новые пути `audio/season4/`, `images/season4/`, `data/lessons-season4.json` и `data/audio_manifest-season4.json`.
7. В сообщении коммита напишите: `Add Spanish Season 4 publications, audio and images`.
8. Нажмите **Commit changes**.

Важно: загружайте содержимое архива в корень существующего репозитория. Не создавайте дополнительную папку `Spanish_Season4_GitHub_REPLACE` внутри репозитория. Файл `data/state.json` заменять или удалять не нужно.

## Автоматическая проверка

1. Откройте **Actions → Publish Spanish course**.
2. Нажмите **Run workflow**.
3. Выберите `slot: check` и запустите workflow.
4. Дождитесь зелёной галочки.

В журнале должны появиться сообщения о 60 MP3, 60 публикациях, 30 ежедневных Poll, 6 итоговых Poll и 5 изображениях Сезона 4.

## Проверка в тестовом Telegram-канале

Откройте **Actions → Preview Spanish Course → Run workflow**. В поле `confirm` вводите `PREVIEW`.

Рекомендуемые проверки:

1. `slot: morning`, `season: 4`, `day: 1` — публикация и голоса Адриана, Диего и Ясмин;
2. `slot: morning`, `season: 4`, `day: 7` — фото первой недели, пост и утреннее аудио;
3. `slot: practice`, `season: 4`, `day: 14` — дневная практика и Poll;
4. `slot: morning`, `season: 4`, `day: 30` — финальный урок;
5. `slot: monthly_polls`, `season: 4` — 6 итоговых вопросов;
6. `slot: congrats`, `season: 4` — финальное изображение и поздравление.

Тестовый запуск не изменяет `data/state.json` и не мешает автоматической публикации.
