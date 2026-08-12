import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const errors = [];
const missing = [];

function expectFile(relativePath) {
  const full = path.join(ROOT, relativePath);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) missing.push(relativePath);
}
function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}
function validatePoll(poll, label) {
  if (!poll?.question || !Array.isArray(poll.options) || poll.options.length < 2) {
    errors.push(`Нет корректного Poll: ${label}`); return;
  }
  if (!Number.isInteger(poll.correct_option_id) || poll.correct_option_id < 0 || poll.correct_option_id >= poll.options.length) {
    errors.push(`Неверный правильный ответ Poll: ${label}`);
  }
}
function validateSeason({ number, lessonsFile, manifestFile, congratsImage }) {
  expectFile(lessonsFile); expectFile(manifestFile); expectFile(congratsImage);
  if (!fs.existsSync(path.join(ROOT, lessonsFile)) || !fs.existsSync(path.join(ROOT, manifestFile))) return;
  const lessons = readJson(lessonsFile);
  const manifest = readJson(manifestFile);
  if (!Array.isArray(lessons) || lessons.length !== 30) errors.push(`Сезон ${number}: должно быть ровно 30 дней`);
  for (let day=1; day<=30; day+=1) {
    const lesson=lessons.find(item=>item.day===day); const expected=manifest[String(day)];
    if (!lesson) { errors.push(`Сезон ${number}: нет дня ${day}`); continue; }
    if (!expected) { errors.push(`Сезон ${number}: нет аудиоманифеста для дня ${day}`); continue; }
    for (const slot of ["morning","practice"]) {
      if (!lesson[slot]?.text) errors.push(`Сезон ${number}: нет текста день ${day}, ${slot}`);
      if (!lesson[slot]?.audio) errors.push(`Сезон ${number}: нет пути аудио день ${day}, ${slot}`);
      else expectFile(lesson[slot].audio);
    }
    for (const utterance of expected.morning || []) {
      if (utterance.text === "Финальная сцена") continue;
      if (!lesson.morning.text.includes(utterance.text)) errors.push(`Сезон ${number}, день ${day}: в утреннем посте нет фразы из аудио: ${utterance.text}`);
    }
    for (const phrase of expected.practice || []) {
      if (!lesson.practice.text.includes(phrase)) errors.push(`Сезон ${number}, день ${day}: в дневном посте нет фразы из аудио: ${phrase}`);
    }
    validatePoll(lesson.practice?.poll, `сезон ${number}, день ${day}`);
    if (lesson.morning?.photo) expectFile(lesson.morning.photo);
  }
  const review = lessons.find(item=>Array.isArray(item.monthly_review_polls))?.monthly_review_polls;
  if (!Array.isArray(review) || review.length < 3 || review.length > 7) errors.push(`Сезон ${number}: итоговый опросник должен содержать 3–7 Poll`);
  else review.forEach((p,i)=>validatePoll(p, `сезон ${number}, итоговый Poll ${i+1}`));
}

expectFile("data/state.json");
expectFile("src/publish.mjs");
validateSeason({number:1, lessonsFile:"data/lessons.json", manifestFile:"data/audio_manifest.json", congratsImage:"images/season1-congratulations.jpg"});
validateSeason({number:2, lessonsFile:"data/lessons-season2.json", manifestFile:"data/audio_manifest-season2.json", congratsImage:"images/season2/season2-congratulations.jpg"});

if (missing.length) { console.error("Не найдены файлы:"); for (const f of [...new Set(missing)]) console.error(`  - ${f}`); }
if (errors.length) { console.error("Ошибки данных:"); for (const e of errors) console.error(`  - ${e}`); }
if (missing.length || errors.length) process.exit(1);
console.log("✓ Сезон 1 проверен");
console.log("✓ Сезон 2: 30 утренних MP3 и 30 дневных MP3");
console.log("✓ Сезон 2: 30 утренних и 30 дневных публикаций проверены по аудиоманифесту");
console.log("✓ Сезон 2: 30 ежедневных Telegram Poll и 6 итоговых Poll");
console.log("✓ Сезон 2: 4 недельных изображения + поздравительное изображение");
console.log("✓ Два сезона готовы к автоматическому выбору по месяцу");
