import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const errors = [];
const missing = [];

function expectFile(relativePath) {
  const full = path.join(ROOT, relativePath);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    missing.push(relativePath);
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

expectFile("images/season1-congratulations.jpg");
expectFile("data/state.json");
expectFile("data/lessons.json");
expectFile("data/audio_manifest.json");
expectFile("src/publish.mjs");

try {
  const lessons = readJson("data/lessons.json");
  const manifest = readJson("data/audio_manifest.json");

  if (!Array.isArray(lessons) || lessons.length !== 30) {
    errors.push("lessons.json должен содержать ровно 30 дней");
  }

  for (let day = 1; day <= 30; day += 1) {
    const lesson = lessons.find(item => item.day === day);
    const expected = manifest[String(day)];

    if (!lesson) {
      errors.push(`Нет дня ${day}`);
      continue;
    }

    if (!expected) {
      errors.push(`Нет аудиоманифеста для дня ${day}`);
      continue;
    }

    for (const slot of ["morning", "practice"]) {
      if (!lesson[slot]?.text) {
        errors.push(`Нет текста: день ${day}, ${slot}`);
      }
      if (!lesson[slot]?.audio) {
        errors.push(`Нет пути аудио: день ${day}, ${slot}`);
      } else {
        expectFile(lesson[slot].audio);
      }
    }

    const morningText = lesson.morning.text;

    if (morningText.includes("💬 Диалог")) {
      errors.push(`День ${day}: остался лишний раздел «Диалог»`);
    }

    if (morningText.includes("✍️ Мини-задание")) {
      errors.push(`День ${day}: осталось утреннее мини-задание`);
    }

    for (const utterance of expected.morning) {
      if (utterance.text === "Финальная сцена") continue;
      if (!morningText.includes(utterance.text)) {
        errors.push(`День ${day}: в утреннем посте нет фразы из аудио: ${utterance.text}`);
      }
    }

    for (const phrase of expected.practice) {
      if (!lesson.practice.text.includes(phrase)) {
        errors.push(`День ${day}: в дневном посте нет фразы из аудио: ${phrase}`);
      }
    }

    const poll = lesson.practice?.poll;
    if (!poll?.question || !Array.isArray(poll.options) || poll.options.length < 2) {
      errors.push(`Нет корректного Poll: день ${day}`);
    }

    if (
      !Number.isInteger(poll?.correct_option_id) ||
      poll.correct_option_id < 0 ||
      poll.correct_option_id >= (poll?.options?.length || 0)
    ) {
      errors.push(`Неверный правильный ответ Poll: день ${day}`);
    }

    if (lesson.morning?.photo) {
      expectFile(lesson.morning.photo);
    }
  }
} catch (error) {
  errors.push(`Не удалось проверить данные: ${error.message}`);
}

if (missing.length) {
  console.error("Не найдены файлы:");
  for (const file of missing) console.error(`  - ${file}`);
}

if (errors.length) {
  console.error("Ошибки данных:");
  for (const error of errors) console.error(`  - ${error}`);
}

if (missing.length || errors.length) {
  process.exit(1);
}

console.log("✓ Найдены 30 утренних MP3");
console.log("✓ Найдены 30 дневных MP3");
console.log("✓ Проверены 30 утренних текстов по финальным аудиосценариям");
console.log("✓ Проверены 30 дневных текстов по финальным аудиосценариям");
console.log("✓ Удалены отдельные разделы «Диалог» и утренние мини-задания");
console.log("✓ Настроены 30 Telegram Poll");
console.log("✓ Найдено поздравительное фото");
console.log("✓ Первый сезон v3.1 готов");
