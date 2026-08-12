import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIALOG_INDENT = "\u00A0\u00A0\u00A0\u00A0\u00A0";
const LESSONS_FILE = path.join(ROOT, "data", "lessons.json");
const STATE_FILE = path.join(ROOT, "data", "state.json");
const CONGRATS_IMAGE = "images/season1-congratulations.jpg";

const CONGRATS_TEXT = `<b>🎉 Поздравляем!</b>\n\nВы прошли весь первый сезон курса.\n\nТеперь вы:\n✅ можете познакомиться\n✅ заказать кофе\n✅ спросить дорогу\n✅ рассказать о себе\n✅ понимать простые диалоги\n\n<b>🏆 Вы молодец!</b>\n\nДо встречи во втором сезоне! 🇪🇸`;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Не задано обязательное значение ${name}`);
  return value;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isSectionHeading(line) {
  return /^(🎬|🗣|💬|⭐|🎧|✍️|🎙)\s/.test(line);
}

function isOption(line) {
  return /^(?:[А-ЯA-ZЁ]\.|\d+[.)]|[а-яa-zё]\))\s/.test(line);
}

function formatAnswer(line) {
  const match = line.match(/^Ответ:\s*(.*)$/u);
  if (!match) return null;
  const answer = match[1].trim();
  return answer ? `Ответ: <tg-spoiler>${escapeHtml(answer)}</tg-spoiler>` : "Ответ:";
}

function formatLessonText(rawText, slot) {
  const source = String(rawText).replaceAll("\r", "").split("\n");
  const output = [];
  let section = "";
  let dialogueSpeakerActive = false;

  const pushBlank = () => {
    if (output.length && output.at(-1) !== "") output.push("");
  };

  for (let index = 0; index < source.length; index += 1) {
    const original = source[index].trim();
    if (!original) {
      pushBlank();
      dialogueSpeakerActive = false;
      continue;
    }
    if (index === 0) {
      output.push(`<b>${escapeHtml(original)}</b>`);
      continue;
    }
    if (slot === "morning" && index === 1) {
      output.push(`<b>${escapeHtml(original)}</b>`);
      continue;
    }
    if (isSectionHeading(original)) {
      pushBlank();
      section = original;
      dialogueSpeakerActive = false;
      output.push(`<u>${escapeHtml(original)}</u>`);
      continue;
    }
    if (original === "👇 Ответьте в опросе ниже.") {
      pushBlank();
      output.push(escapeHtml(original));
      continue;
    }
    const answer = formatAnswer(original);
    if (answer !== null) {
      output.push(answer);
      continue;
    }
    const speaker = original.match(/^(👩|👨|🧑‍🍳)\s+(.+)$/u);
    if (speaker) {
      output.push(`${speaker[1]} <b>${escapeHtml(speaker[2])}</b>`);
      dialogueSpeakerActive = true;
      continue;
    }
    if (dialogueSpeakerActive) {
      output.push(`${DIALOG_INDENT}${escapeHtml(original)}`);
      continue;
    }
    if (/^🗣\s(?:Новые слова|Повторяем)/u.test(section)) {
      output.push(`🔹 ${escapeHtml(original.replace(/^🔹\s*/u, ""))}`);
      continue;
    }
    if (isOption(original) || original.startsWith("—")) {
      output.push(escapeHtml(original.trim()));
      continue;
    }
    output.push(escapeHtml(original));
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function localParts(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    date: `${values.year}-${values.month}-${values.day}`,
    yearMonth: `${values.year}-${values.month}`,
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

function validateStartDate(value) {
  if (!/^\d{4}-\d{2}-01$/.test(value || "")) {
    throw new Error("START_DATE должна быть первым числом месяца: YYYY-MM-01");
  }
  if (Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`Некорректная START_DATE: ${value}`);
  }
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function minutesOfDay(hour, minute) {
  return hour * 60 + minute;
}

function scheduleKind(cron) {
  const value = String(cron || "").trim();
  if (value === "0 7 * * *") return "morning";
  if (value === "0 12 * * *") return "practice";
  if (value === "0 14 * * *") return "monthly_polls";
  if (value === "0 16 * * *") return "congrats";
  return null;
}

function isPastCutoff(now, cutoffHour, cutoffMinute) {
  return minutesOfDay(now.hour, now.minute) >= minutesOfDay(cutoffHour, cutoffMinute);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function telegram(method, body) {
  const token = required("BOT_TOKEN");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    body
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(`${method}: ${result.description || JSON.stringify(result)}`);
  }
  return result.result;
}

async function sendText(chatId, rawText, slot) {
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("text", formatLessonText(rawText, slot));
  form.set("parse_mode", "HTML");
  form.set("disable_web_page_preview", "true");
  await telegram("sendMessage", form);
}

async function sendFile(method, chatId, field, relativeFile, extra = {}) {
  const fullPath = path.join(ROOT, relativeFile);
  if (!fs.existsSync(fullPath)) throw new Error(`Файл не найден: ${relativeFile}`);
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set(field, new Blob([fs.readFileSync(fullPath)]), path.basename(fullPath));
  for (const [key, value] of Object.entries(extra)) form.set(key, String(value));
  await telegram(method, form);
}

async function sendQuizPoll(chatId, poll) {
  if (!poll?.question || !Array.isArray(poll.options)) {
    throw new Error("Отсутствуют данные Telegram Poll");
  }
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("question", poll.question);
  form.set("options", JSON.stringify(poll.options));
  form.set("type", "quiz");
  form.set("is_anonymous", "true");
  form.set("correct_option_id", String(poll.correct_option_id));
  await telegram("sendPoll", form);
}

function markPublished(context, key) {
  if (context.runMode !== "official") return;
  context.state.published[key] = new Date().toISOString();
  writeState(context.state);
}

function alreadyPublished(context, key, legacyKey = null) {
  if (context.runMode !== "official") return false;
  if (context.state.published[key]) return true;
  if (!legacyKey) return false;
  const startMonth = context.startDate.slice(0, 7);
  return context.now.yearMonth === startMonth && Boolean(context.state.published[legacyKey]);
}

async function publishLessonSlot(context) {
  const { channel, lessons, day, slot, seasonLength, now } = context;
  if (day < 1 || day > seasonLength) {
    console.log(`В день ${day} учебный пост не предусмотрен. Длина сезона: ${seasonLength}.`);
    return;
  }

  const lesson = lessons.find(item => item.day === day)?.[slot];
  if (!lesson?.text || !lesson?.audio) throw new Error(`Нет данных: день ${day}, ${slot}`);

  const baseKey = `${now.yearMonth}-${day}-${slot}`;
  const legacyKey = `${day}-${slot}`;
  const completeKey = `${baseKey}-complete`;
  if (alreadyPublished(context, completeKey) || alreadyPublished(context, baseKey, legacyKey)) {
    console.log(`${baseKey} уже опубликован. Повтор отменён.`);
    return;
  }

  if (slot === "morning" && lesson.photo) {
    const photoKey = `${baseKey}-photo`;
    if (!alreadyPublished(context, photoKey)) {
      await sendFile("sendPhoto", channel, "photo", lesson.photo, {
        caption: day === seasonLength ? "🏆 Финал сезона" : `🌿 Итоги недели • День ${day}`
      });
      markPublished(context, photoKey);
    }
  }

  const textKey = `${baseKey}-text`;
  if (!alreadyPublished(context, textKey)) {
    await sendText(channel, lesson.text, slot);
    markPublished(context, textKey);
  }

  const audioKey = `${baseKey}-audio`;
  if (!alreadyPublished(context, audioKey)) {
    await sendFile("sendAudio", channel, "audio", lesson.audio, {
      title: slot === "morning" ? `Сезон 1 • День ${day} • Утро` : `Сезон 1 • День ${day} • Практика`,
      performer: "Испанский через истории"
    });
    markPublished(context, audioKey);
  }

  if (slot === "practice") {
    const pollKey = `${baseKey}-poll`;
    if (!alreadyPublished(context, pollKey)) {
      await sendQuizPoll(channel, lesson.poll);
      markPublished(context, pollKey);
    }
  }

  markPublished(context, completeKey);
}

async function publishMonthlyReview(context) {
  const day = context.seasonLength;
  const dayData = context.lessons.find(item => item.day === day);
  const polls = dayData?.monthly_review_polls;
  if (!Array.isArray(polls) || polls.length < 1) {
    throw new Error(`Для дня ${day} отсутствует monthly_review_polls`);
  }

  for (let index = 0; index < polls.length; index += 1) {
    const key = `${context.now.yearMonth}-monthly-review-${index + 1}`;
    if (alreadyPublished(context, key)) {
      console.log(`Итоговый Poll ${index + 1}/${polls.length} уже опубликован.`);
      continue;
    }
    await sendQuizPoll(context.channel, polls[index]);
    markPublished(context, key);
  }
}

async function publishCongrats(context) {
  const key = `${context.now.yearMonth}-congrats`;
  if (alreadyPublished(context, key)) {
    console.log("Поздравление уже опубликовано. Повтор отменён.");
    return;
  }
  await sendFile("sendPhoto", context.channel, "photo", CONGRATS_IMAGE, {
    caption: CONGRATS_TEXT,
    parse_mode: "HTML"
  });
  markPublished(context, key);
}

async function retryEveryFiveMinutes({ name, timeZone, cutoffHour, cutoffMinute, task }) {
  let attempt = 1;
  while (true) {
    try {
      console.log(`${name}: попытка ${attempt}.`);
      await task();
      return;
    } catch (error) {
      const now = localParts(timeZone);
      console.error(`${name}: попытка ${attempt} не удалась: ${error.message}`);
      if (isPastCutoff(now, cutoffHour, cutoffMinute)) {
        throw new Error(`${name}: окно повторных попыток завершено. Последняя ошибка: ${error.message}`);
      }
      console.log(`${name}: следующая попытка через 5 минут.`);
      await sleep(5 * 60 * 1000);
      attempt += 1;
    }
  }
}

async function runScheduledTask(context, timeZone, cron) {
  const kind = scheduleKind(cron);
  if (!kind) throw new Error(`Неизвестное расписание: ${cron || "пусто"}`);

  if (kind === "morning") {
    await retryEveryFiveMinutes({
      name: "Утренний урок",
      timeZone,
      cutoffHour: 9,
      cutoffMinute: 0,
      task: () => publishLessonSlot({ ...context, day: context.now.day, slot: "morning" })
    });
    return;
  }

  if (kind === "practice") {
    await retryEveryFiveMinutes({
      name: "Дневная практика",
      timeZone,
      cutoffHour: 14,
      cutoffMinute: 0,
      task: () => publishLessonSlot({ ...context, day: context.now.day, slot: "practice" })
    });
    return;
  }

  if (kind === "monthly_polls") {
    if (context.now.day !== context.finalCalendarDay) {
      console.log("Сегодня не последний день месяца — итоговый опросник не требуется.");
      return;
    }
    await retryEveryFiveMinutes({
      name: "Итоговый опросник месяца",
      timeZone,
      cutoffHour: 16,
      cutoffMinute: 0,
      task: () => publishMonthlyReview(context)
    });
    return;
  }

  if (context.now.day !== context.finalCalendarDay) {
    console.log("Сегодня не последний день месяца — поздравление не требуется.");
    return;
  }

  await retryEveryFiveMinutes({
    name: "Поздравление месяца",
    timeZone,
    cutoffHour: 18,
    cutoffMinute: 0,
    task: () => publishCongrats(context)
  });
}

async function main() {
  const channel = required("CHANNEL_ID");
  const timeZone = process.env.TIMEZONE?.trim() || "Europe/Moscow";
  const startDate = required("START_DATE");
  const eventType = process.env.EVENT_TYPE?.trim() || "manual";
  const scheduleCron = process.env.SCHEDULE_CRON?.trim() || "";
  const runMode = process.env.RUN_MODE?.trim() || "official";
  const manualDay = Number(process.env.MANUAL_DAY || 0);
  const manualSlot = process.env.MANUAL_SLOT?.trim();

  validateStartDate(startDate);
  if (!["official", "test"].includes(runMode)) throw new Error(`Неизвестный RUN_MODE: ${runMode}`);

  const lessons = readJson(LESSONS_FILE);
  const state = readJson(STATE_FILE);
  if (!Array.isArray(lessons) || lessons.length < 28 || lessons.length > 31) {
    throw new Error("lessons.json должен содержать от 28 до 31 дня");
  }
  if (!state.published || typeof state.published !== "object") state.published = {};

  const now = localParts(timeZone);
  const monthDays = daysInMonth(now.year, now.month);
  const seasonLength = Math.min(monthDays, lessons.length);
  const finalCalendarDay = monthDays;

  if (Date.parse(`${now.date}T00:00:00Z`) < Date.parse(`${startDate}T00:00:00Z`)) {
    console.log("Курс ещё не начался.");
    return;
  }

  const context = { channel, lessons, state, now, startDate, seasonLength, finalCalendarDay, runMode };

  if (eventType === "schedule") {
    await runScheduledTask(context, timeZone, scheduleCron);
  } else {
    if (!["morning", "practice", "monthly_polls", "congrats"].includes(manualSlot)) {
      throw new Error(`Некорректный ручной слот: ${manualSlot}`);
    }
    const day = manualDay > 0 ? manualDay : now.day;
    if (manualSlot === "morning" || manualSlot === "practice") {
      await publishLessonSlot({ ...context, day, slot: manualSlot });
    } else if (manualSlot === "monthly_polls") {
      await publishMonthlyReview(context);
    } else {
      await publishCongrats(context);
    }
  }

  if (runMode === "official") {
    writeState(state);
    console.log("Состояние публикации сохранено.");
  }
}

main().catch(error => {
  console.error(`ОШИБКА: ${error.message}`);
  process.exit(1);
});
