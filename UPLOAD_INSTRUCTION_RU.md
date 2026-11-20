# Обновление репозитория «Испанский через истории» — Сезон 5

Комплект добавляет пятый сезон и сохраняет без изменений сезоны 1–4 и текущее состояние публикаций.

## Что добавлено и обновлено

- `audio/season5/morning/day01.mp3` … `day30.mp3` — 30 утренних аудио;
- `audio/season5/practice/day01.mp3` … `day30.mp3` — 30 дневных аудио;
- `images/season5/day07.jpg`, `day14.jpg`, `day21.jpg`, `day28.jpg` — четыре недельных изображения;
- `images/season5/season5-congratulations.jpg` — финальное изображение;
- `data/lessons-season5.json` — 30 утренних и 30 дневных публикаций, 30 ежедневных Poll и 6 итоговых Poll;
- `data/audio_manifest-season5.json` — проверочный манифест всех сценариев аудио;
- `src/publish.mjs` и `src/check-files.mjs` — поддержка сезона 5;
- `.github/workflows/preview.yml` — сезон 5 в тестовом запуске;
- `.github/workflows/repair-audio.yml` — сезон 5 в восстановлении совместимости MP3;
- `README.md` — актуальное описание пяти сезонов и расписания.

## Как загрузить через сайт GitHub

1. Скачайте и распакуйте `Spanish_Season5_GitHub_REPLACE.zip`.
2. Откройте репозиторий `spanish-course-publisher` на GitHub.
3. Перейдите в корень репозитория, где видны `.github`, `audio`, `data`, `images` и `src`.
4. Нажмите **Add file → Upload files**.
5. Перетащите в окно всё содержимое распакованного архива: `.github`, `audio`, `data`, `images`, `src`, `README.md` и `UPLOAD_INSTRUCTION_RU.md`.
6. Проверьте новые пути `audio/season5/`, `images/season5/`, `data/lessons-season5.json` и `data/audio_manifest-season5.json`.
7. В сообщении коммита напишите: `Add Spanish Season 5 publications, audio and images`.
8. Нажмите **Commit changes**.

Важно:

- загружайте содержимое архива в корень существующего репозитория;
- не создавайте дополнительную папку `Spanish_Season5_GitHub_REPLACE`;
- не удаляйте сезоны 1–4;
- файл `data/state.json` не входит в комплект замены и должен остаться текущим.

## Автоматическая проверка

1. Откройте **Actions → Publish Spanish course**.
2. Нажмите **Run workflow**.
3. Выберите `slot: check` и запустите workflow.
4. Дождитесь зелёной галочки.

В журнале должны появиться сообщения:

- 30 утренних и 30 дневных MP3 сезона 5;
- 30 утренних и 30 дневных публикаций;
- 30 ежедневных Poll и 6 итоговых Poll;
- 4 недельных изображения и поздравительное изображение;
- пять сезонов готовы к автоматическому выбору.

## Проверка в тестовом Telegram-канале

Откройте **Actions → Preview Spanish Course → Run workflow**. В поле `confirm` введите `PREVIEW`.

Рекомендуемые проверки:

1. `slot: morning`, `season: 5`, `day: 1` — Ясмин, Адриан и Диего, утренний пост и аудио;
2. `slot: morning`, `season: 5`, `day: 7` — фото рынка, пост и утреннее аудио;
3. `slot: morning`, `season: 5`, `day: 9` — продавец использует отдельный сервисный голос;
4. `slot: practice`, `season: 5`, `day: 14` — дневная практика и Poll;
5. `slot: morning`, `season: 5`, `day: 21` — ресторан, фото, пост и аудио;
6. `slot: morning`, `season: 5`, `day: 30` — финальный урок;
7. `slot: monthly_polls`, `season: 5` — 6 итоговых вопросов;
8. `slot: congrats`, `season: 5` — финальное изображение и поздравление.

Тестовый запуск не изменяет `data/state.json` и не мешает автоматической публикации.

## Автоматическое включение сезона

Сезон выбирается по месяцу относительно GitHub Variable `START_DATE`:

- месяц `START_DATE` — сезон 1;
- следующий месяц — сезон 2;
- пятый месяц от `START_DATE` — сезон 5.

Менять `START_DATE` перед сезоном 5 не нужно. Проверьте только, что переменная по-прежнему содержит дату первого дня первого сезона в формате `YYYY-MM-01`.
