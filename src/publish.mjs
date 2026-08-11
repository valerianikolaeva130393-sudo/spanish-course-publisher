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
  return answer
    ? `Ответ: <tg-spoiler>${escapeHtml(answer)}</tg-spoiler>`
    : "Ответ:";
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

function removeFinalDayProgressSection(rawText) {
  const lines = String(rawText).replaceAll("\r", "").split("\n");
  const result = [];
  let skipping = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^(?:✅|⭐|🎯|📚|🏆)?\s*Сегодня вы уже (?:умеете|можете)/iu.test(trimmed)) {
      skipping = true;
      continue;
    }

    if (
      skipping &&
      /^(🎬|🗣|💬|⭐|🎧|✍️|🎙|👇|☀️)\s/u.test(trimmed)
    ) {
      skipping = false;
    }

    if (!skipping) result.push(line);
  }

  return result
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

  const context = {
    channel,
    lessons,
    state,
    now,
    startDate,
    seasonLength,
    finalCalendarDay,
    runMode
  };

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
