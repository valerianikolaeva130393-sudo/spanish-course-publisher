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

function formatLessonText(rawText, slot) {
  const source = String(rawText).replaceAll("\r", "").split("\n");
  const output = [];
  let section = "";
  let afterSpeaker = false;

  const pushBlank = () => {
    if (output.length && output.at(-1) !== "") output.push("");
  };

  for (let index = 0; index < source.length; index += 1) {
    const original = source[index].trim();
    if (!original) {
      pushBlank();
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
      afterSpeaker = false;
      output.push(`<u>${escapeHtml(original)}</u>`);
      continue;
    }

    const speaker = original.match(/^(👩|👨|🧑‍🍳)\s+(.+)$/u);
    if (speaker) {
      output.push(`${speaker[1]} <b>${escapeHtml(speaker[2])}</b>`);
      afterSpeaker = true;
      continue;
    }

    if (afterSpeaker) {
      output.push(`${DIALOG_INDENT}${escapeHtml(original)}`);
      afterSpeaker = false;
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

    if ((/^💬/u.test(section) || /^🎧/u.test(section)) && original.length <= 100) {
      output.push(escapeHtml(original));
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
    throw new Error("Для дневной практики отсутствует poll");
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

async function sendCongratulations(chatId) {
  await sendFile("sendPhoto", chatId, "photo", CONGRATS_IMAGE, {
    caption: CONGRATS_TEXT,
    parse_mode: "HTML"
  });
}

function scheduledSlot(now) {
  if (now.hour === 7) return "morning";
  if (now.hour === 14) return "practice";
  if (now.hour === 18) return "congrats";
  return null;
}

async function main() {
  const channel = required("CHANNEL_ID");
  const timeZone = process.env.TIMEZONE?.trim() || "Europe/Moscow";
  const startDate = required("START_DATE");
  const eventType = process.env.EVENT_TYPE?.trim() || "manual";
  const runMode = process.env.RUN_MODE?.trim() || "official";
  const manualDay = Number(process.env.MANUAL_DAY || 0);
  const manualSlot = process.env.MANUAL_SLOT?.trim();

  validateStartDate(startDate);
  if (!['official', 'test'].includes(runMode)) throw new Error(`Неизвестный RUN_MODE: ${runMode}`);

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

  let slot;
  let day;
  if (eventType === "schedule") {
    slot = scheduledSlot(now);
    day = now.day;
    if (!slot) return;
  } else {
    if (!['morning', 'practice', 'congrats'].includes(manualSlot)) {
      throw new Error(`Некорректный ручной слот: ${manualSlot}`);
    }
    slot = manualSlot;
    day = manualDay > 0 ? manualDay : now.day;
  }

  if (slot === "congrats") {
    if (eventType === "schedule" && now.day !== finalCalendarDay) {
      console.log("Сегодня не последний день месяца — поздравление не требуется.");
      return;
    }
    const key = `${now.yearMonth}-congrats`;
    if (runMode === "official" && state.published[key]) {
      console.log("Поздравление уже опубликовано. Повтор отменён.");
      return;
    }
    await sendCongratulations(channel);
    if (runMode === "official") state.published[key] = new Date().toISOString();
  } else {
    if (day < 1 || day > seasonLength) {
      console.log(`В день ${day} учебный пост не предусмотрен. Длина сезона: ${seasonLength}.`);
      return;
    }

    const key = `${now.yearMonth}-${day}-${slot}`;
    const startMonth = startDate.slice(0, 7);
    const legacyKey = `${day}-${slot}`;
    if (runMode === "official" && (state.published[key] || (now.yearMonth === startMonth && state.published[legacyKey]))) {
      console.log(`${key} уже опубликован. Повтор отменён.`);
      return;
    }

    const lesson = lessons.find(item => item.day === day)?.[slot];
    if (!lesson?.text || !lesson?.audio) throw new Error(`Нет данных: день ${day}, ${slot}`);

    if (slot === "morning" && lesson.photo) {
      await sendFile("sendPhoto", channel, "photo", lesson.photo, {
        caption: day === seasonLength ? "🏆 Финал сезона" : `🌿 Итоги недели • День ${day}`
      });
    }

    await sendText(channel, lesson.text, slot);
    await sendFile("sendAudio", channel, "audio", lesson.audio, {
      title: slot === "morning" ? `Сезон • День ${day} • Утро` : `Сезон • День ${day} • Практика`,
      performer: "Испанский через истории"
    });
    if (slot === "practice") await sendQuizPoll(channel, lesson.poll);

    if (runMode === "official") state.published[key] = new Date().toISOString();
  }

  if (runMode === "official") {
    fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    console.log("Состояние публикации сохранено.");
  }
}

main().catch(error => {
  console.error(`ОШИБКА: ${error.message}`);
  process.exit(1);
});
