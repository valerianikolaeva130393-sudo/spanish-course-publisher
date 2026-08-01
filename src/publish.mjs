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

/**
 * Превращает утверждённый обычный текст урока в единый Telegram HTML-шаблон.
 * В исходном lessons.json HTML хранить не нужно.
 */
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

    // Главный заголовок публикации.
    if (index === 0) {
      output.push(`<b>${escapeHtml(original)}</b>`);
      continue;
    }

    // В утреннем уроке вторая строка — ключевая фраза дня.
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

    // Утверждённый вид диалога: имя героя отдельной строкой,
    // реплика — с горизонтальным отступом слева.
    const speaker = original.match(/^(Yasmin|Adrián):\s*(.*)$/u);
    if (speaker) {
      const icon = speaker[1] === "Yasmin" ? "👩" : "👨";
      output.push(`${icon} <b>${speaker[1]}</b>`);
      if (speaker[2]) output.push(`${INDENT}${escapeHtml(speaker[2])}`);
      continue;
    }

    // В разделе новых слов каждая строка оформляется маркером.
    if (/^🗣\s(?:Новые слова|Повторяем)/u.test(section)) {
      output.push(`🔹 ${escapeHtml(original.replace(/^🔹\s*/u, ""))}`);
      continue;
    }

    // Варианты ответа, реплики с тире и строки повторения получают
    // только горизонтальный отступ — без пустых строк между ними.
    if (isOption(original) || original.startsWith("—")) {
      output.push(`${INDENT}${escapeHtml(original)}`);
      continue;
    }

    // Фразы под разделами «Диалог» и «Послушайте» также сдвигаем влево,
    // если это короткая языковая строка, а не пояснение по-русски.
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
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date());
    const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return {
      date: `${v.year}-${v.month}-${v.day}`,
      hour: Number(v.hour),
      minute: Number(v.minute)
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
  if (Number.isNaN(parsed)) throw new Error(`Некорректная дата START_DATE: ${value}`);
}

function dateDiffDays(startDate, currentDate) {
  const a = Date.parse(`${startDate}T00:00:00Z`);
  const b = Date.parse(`${currentDate}T00:00:00Z`);
  return Math.floor((b - a) / 86400000);
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

function splitHtmlMessage(text, limit = 3900) {
  if (text.length <= limit) return [text];
  const paragraphs = text.split("\n\n");
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
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
  const full = path.join(ROOT, relativeFile);
  if (!fs.existsSync(full)) throw new Error(`Файл не найден: ${relativeFile}`);
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set(field, new Blob([fs.readFileSync(full)]), path.basename(full));
  for (const [key, value] of Object.entries(extra)) form.set(key, String(value));
  await telegram(method, form);
}

function slotFromSchedule(hour, minute) {
  if (hour === 7 && minute <= 49) return "morning";
  if (hour === 14 && minute <= 49) return "practice";
  return null;
}

async function main() {
  const channel = required("CHANNEL_ID");
  const timeZone = process.env.TIMEZONE?.trim() || "Europe/Moscow";
  const startDate = process.env.START_DATE?.trim();
  const manualDay = Number(process.env.MANUAL_DAY || 0);
  const manualSlot = process.env.MANUAL_SLOT?.trim();
  const scheduleSlot = process.env.SCHEDULE_SLOT?.trim();
  const testMode = process.env.TEST_MODE === "true";
  const lessons = readJson(LESSONS_FILE);
  const state = readJson(STATE_FILE);

  if (!Array.isArray(lessons) || lessons.length !== 30) {
    throw new Error("data/lessons.json должен содержать ровно 30 дней");
  }
  if (!state.published || typeof state.published !== "object") state.published = {};

  let day;
  let slot;
  let publicationDate;

  if (manualDay && ["morning", "practice"].includes(manualSlot)) {
    day = manualDay;
    slot = manualSlot;
    publicationDate = `manual-${new Date().toISOString()}`;
  } else {
    if (!startDate) throw new Error("Не задана переменная START_DATE в GitHub Actions Variables");
    validateStartDate(startDate);
    const now = localParts(timeZone);
    slot = ["morning", "practice"].includes(scheduleSlot)
      ? scheduleSlot
      : slotFromSchedule(now.hour, now.minute);

    if (!slot) {
      console.log(`Сейчас ${now.hour}:${String(now.minute).padStart(2, "0")} (${timeZone}), публикация не требуется.`);
      return;
    }

    day = dateDiffDays(startDate, now.date) + 1;
    publicationDate = now.date;
  }

  if (!Number.isInteger(day) || day < 1 || day > 30) {
    console.log(`День курса ${day}: сезон ещё не начался или уже завершён.`);
    return;
  }

  const key = `${day}-${slot}`;
  if (!manualDay && state.published[key]) {
    console.log(`${key} уже опубликован ${state.published[key]}.`);
    return;
  }

  const lesson = lessons.find(item => item.day === day)?.[slot];
  if (!lesson?.text || !lesson?.audio) {
    throw new Error(`Нет полных данных для дня ${day}, слот ${slot}`);
  }

  console.log(`Публикуем день ${day}, ${slot}${testMode ? " (тест)" : ""}`);

  if (slot === "morning" && lesson.photo) {
    await sendFile("sendPhoto", channel, "photo", lesson.photo, {
      caption: day === 30 ? "🏆 Финал первого сезона" : `🌿 Итоги недели • День ${day}`
    });
  }

  await sendText(channel, lesson.text, slot);
  await sendFile("sendAudio", channel, "audio", lesson.audio, {
    title: slot === "morning"
      ? `Сезон 1 • День ${day} • Утро`
      : `Сезон 1 • День ${day} • Практика`,
    performer: "Испанский через истории"
  });

  if (!manualDay && !testMode) {
    state.published[key] = publicationDate;
    fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    console.log(`Состояние сохранено: ${key}`);
  }
}

main().catch(error => {
  console.error(`ОШИБКА: ${error.message}`);
  process.exit(1);
});
