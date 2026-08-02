import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LESSONS_FILE = path.join(ROOT, "data", "lessons.json");
const STATE_FILE = path.join(ROOT, "data", "state.json");
const INDENT = "\u00A0\u00A0\u00A0\u00A0\u00A0";

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

function formatAnswer(line) {
  const match = line.match(/^Ответ:\s*(.*)$/u);
  if (!match) return null;
  const answer = match[1].trim();
  return answer
    ? `Ответ: <tg-spoiler>${escapeHtml(answer)}</tg-spoiler>`
    : "Ответ:";
}

function formatLessonText(rawText, slot) {
  const source = String(rawText).replaceAll("\r", "").split("\n");
  const output = [];
  let section = "";

  const pushBlank = () => {
    if (output.length && output.at(-1) !== "") output.push("");
  };

  for (let index = 0; index < source.length; index += 1) {
    const original = source[index].trim();
    if (!original) continue;

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
      output.push(`<u>${escapeHtml(original)}</u>`);
      continue;
    }

    const answer = formatAnswer(original);
    if (answer !== null) {
      output.push(answer);
      pushBlank();
      continue;
    }

    const speaker = original.match(/^(Yasmin|Adrián):\s*(.*)$/u);
    if (speaker) {
      const icon = speaker[1] === "Yasmin" ? "👩" : "👨";
      output.push(`${icon} <b>${speaker[1]}</b>`);
      if (speaker[2]) output.push(`${INDENT}${escapeHtml(speaker[2])}`);
      continue;
    }

    if (/^🗣\s(?:Новые слова|Повторяем)/u.test(section)) {
      output.push(`🔹 ${escapeHtml(original.replace(/^🔹\s*/u, ""))}`);
      continue;
    }

    if (isOption(original) || original.startsWith("—")) {
      output.push(`${INDENT}${escapeHtml(original)}`);
      continue;
    }

    if ((/^💬/u.test(section) || /^🎧/u.test(section)) && original.length <= 80) {
      output.push(`${INDENT}${escapeHtml(original)}`);
      continue;
    }

    output.push(escapeHtml(original));
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function localParts(timeZone) {
  try {
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
      date: `${values.year}-${values.month}-${values.day}`,
      hour: Number(values.hour),
      minute: Number(values.minute)
    };
  } catch {
    throw new Error(`Некорректный часовой пояс TIMEZONE: ${timeZone}`);
  }
}

function validateStartDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    throw new Error("START_DATE должна иметь формат YYYY-MM-DD, например 2026-08-01");
  }

  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    throw new Error(`Некорректная дата START_DATE: ${value}`);
  }
}

function dateDiffDays(startDate, currentDate) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const current = Date.parse(`${currentDate}T00:00:00Z`);
  return Math.floor((current - start) / 86400000);
}

async function telegram(method, body) {
  const token = required("BOT_TOKEN");

  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      body
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      `${method}: ${result.description || JSON.stringify(result)}`
    );
  }

  return result.result;
}

function splitHtmlMessage(text, limit = 3900) {
  if (text.length <= limit) return [text];

  const paragraphs = text.split("\n\n");
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current
      ? `${current}\n\n${paragraph}`
      : paragraph;

    if (candidate.length > limit && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function sendText(chatId, rawText, slot) {
  const formatted = formatLessonText(rawText, slot);

  for (const chunk of splitHtmlMessage(formatted)) {
    const form = new FormData();
    form.set("chat_id", chatId);
    form.set("text", chunk);
    form.set("parse_mode", "HTML");
    form.set("disable_web_page_preview", "true");
    await telegram("sendMessage", form);
  }
}

async function sendFile(method, chatId, field, relativeFile, extra = {}) {
  const fullPath = path.join(ROOT, relativeFile);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Файл не найден: ${relativeFile}`);
  }

  const form = new FormData();
  form.set("chat_id", chatId);
  form.set(
    field,
    new Blob([fs.readFileSync(fullPath)]),
    path.basename(fullPath)
  );

  for (const [key, value] of Object.entries(extra)) {
    form.set(key, String(value));
  }

  await telegram(method, form);
}

function scheduledSlot(now) {
  // Задержанный на несколько часов workflow ничего не публикует.
  if (now.hour === 7) return "morning";
  if (now.hour === 14) return "practice";
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

  if (!["official", "test"].includes(runMode)) {
    throw new Error(`Неизвестный RUN_MODE: ${runMode}`);
  }

  validateStartDate(startDate);

  const lessons = readJson(LESSONS_FILE);
  const state = readJson(STATE_FILE);

  if (!Array.isArray(lessons) || lessons.length !== 30) {
    throw new Error("data/lessons.json должен содержать ровно 30 дней");
  }

  if (!state.published || typeof state.published !== "object") {
    state.published = {};
  }

  const now = localParts(timeZone);
  let day;
  let slot;

  if (eventType === "schedule") {
    slot = scheduledSlot(now);

    if (!slot) {
      console.log(
        `Задержанный запуск: сейчас ${now.hour}:${String(now.minute).padStart(2, "0")} ` +
        `(${timeZone}). Публикация пропущена, чтобы не отправлять пост на несколько часов позже.`
      );
      return;
    }

    day = dateDiffDays(startDate, now.date) + 1;
  } else {
    if (!["morning", "practice"].includes(manualSlot)) {
      throw new Error(`Некорректный ручной слот: ${manualSlot}`);
    }

    slot = manualSlot;
    day = manualDay > 0
      ? manualDay
      : dateDiffDays(startDate, now.date) + 1;
  }

  if (!Number.isInteger(day) || day < 1 || day > 30) {
    console.log(`День курса ${day}: сезон ещё не начался или уже завершён.`);
    return;
  }

  const key = `${day}-${slot}`;
  const official = runMode === "official";

  if (official && state.published[key]) {
    console.log(
      `${key} уже опубликован ${state.published[key]}. Повторная отправка отменена.`
    );
    return;
  }

  const lesson = lessons.find(item => item.day === day)?.[slot];

  if (!lesson?.text || !lesson?.audio) {
    throw new Error(`Нет полных данных для дня ${day}, слот ${slot}`);
  }

  console.log(
    `Публикуем день ${day}, ${slot}, режим ${runMode}, событие ${eventType}`
  );

  if (slot === "morning" && lesson.photo) {
    await sendFile(
      "sendPhoto",
      channel,
      "photo",
      lesson.photo,
      {
        caption: day === 30
          ? "🏆 Финал первого сезона"
          : `🌿 Итоги недели • День ${day}`
      }
    );
  }

  await sendText(channel, lesson.text, slot);

  await sendFile(
    "sendAudio",
    channel,
    "audio",
    lesson.audio,
    {
      title: slot === "morning"
        ? `Сезон 1 • День ${day} • Утро`
        : `Сезон 1 • День ${day} • Практика`,
      performer: "Испанский через истории"
    }
  );

  if (official) {
    state.published[key] = new Date().toISOString();
    fs.writeFileSync(
      STATE_FILE,
      `${JSON.stringify(state, null, 2)}\n`,
      "utf8"
    );

    console.log(`Состояние сохранено: ${key}`);
  } else {
    console.log(
      `Тестовый режим: ${key} опубликован, но state.json не изменён.`
    );
  }
}

main().catch(error => {
  console.error(`ОШИБКА: ${error.message}`);
  process.exit(1);
});
