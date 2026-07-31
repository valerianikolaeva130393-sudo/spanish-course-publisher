import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LESSONS_FILE = path.join(ROOT, "data", "lessons.json");
const STATE_FILE = path.join(ROOT, "data", "state.json");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Не задано обязательное значение ${name}`);
  return value;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function localParts(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { date: `${v.year}-${v.month}-${v.day}`, hour: Number(v.hour), minute: Number(v.minute) };
}

function dateDiffDays(startDate, currentDate) {
  const a = Date.parse(`${startDate}T00:00:00Z`);
  const b = Date.parse(`${currentDate}T00:00:00Z`);
  return Math.floor((b - a) / 86400000);
}

async function telegram(method, body) {
  const token = required("BOT_TOKEN");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`${method}: ${JSON.stringify(result)}`);
  return result.result;
}

async function sendText(chatId, text) {
  // Telegram message limit is 4096 characters. Split only at paragraph boundaries.
  const chunks = [];
  let current = "";
  for (const paragraph of text.split("\n")) {
    const candidate = current ? `${current}\n${paragraph}` : paragraph;
    if (candidate.length > 3900 && current) { chunks.push(current); current = paragraph; }
    else current = candidate;
  }
  if (current) chunks.push(current);
  for (const chunk of chunks) {
    const form = new FormData();
    form.set("chat_id", chatId);
    form.set("text", chunk);
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
  const testMode = process.env.TEST_MODE === "true";
  const lessons = readJson(LESSONS_FILE);
  const state = readJson(STATE_FILE);

  let day, slot, publicationDate;
  if (manualDay && ["morning", "practice"].includes(manualSlot)) {
    day = manualDay; slot = manualSlot; publicationDate = `manual-${new Date().toISOString()}`;
  } else {
    if (!startDate) throw new Error("Не задана переменная START_DATE в GitHub Actions Variables");
    const now = localParts(timeZone);
    slot = slotFromSchedule(now.hour, now.minute);
    if (!slot) { console.log(`Сейчас ${now.hour}:${String(now.minute).padStart(2,"0")} (${timeZone}), публикация не требуется.`); return; }
    day = dateDiffDays(startDate, now.date) + 1;
    publicationDate = now.date;
  }

  if (day < 1 || day > 30) { console.log(`День курса ${day}: сезон ещё не начался или уже завершён.`); return; }
  const key = `${day}-${slot}`;
  if (!manualDay && state.published[key]) { console.log(`${key} уже опубликован ${state.published[key]}.`); return; }

  const lesson = lessons.find(x => x.day === day)?.[slot];
  if (!lesson) throw new Error(`Нет данных для дня ${day}, слот ${slot}`);

  console.log(`Публикуем день ${day}, ${slot}${testMode ? " (тест)" : ""}`);
  if (slot === "morning" && lesson.photo) {
    await sendFile("sendPhoto", channel, "photo", lesson.photo, { caption: day === 30 ? "🏆 Финал первого сезона" : `🌿 Итоги недели • День ${day}` });
  }
  await sendText(channel, lesson.text);
  await sendFile("sendAudio", channel, "audio", lesson.audio, {
    title: slot === "morning" ? `Сезон 1 • День ${day} • Утро` : `Сезон 1 • День ${day} • Практика`,
    performer: "Испанский через истории"
  });

  if (!manualDay && !testMode) {
    state.published[key] = publicationDate;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
    console.log(`Состояние сохранено: ${key}`);
  }
}

main().catch(error => { console.error(error); process.exit(1); });
