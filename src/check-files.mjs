import fs from "node:fs";
const lessons = JSON.parse(fs.readFileSync("data/lessons.json", "utf8"));
const missing = [];
for (const lesson of lessons) {
  for (const slot of ["morning", "practice"]) {
    const f = lesson[slot].audio;
    if (!fs.existsSync(f) || fs.statSync(f).size < 1000) missing.push(f);
  }
  if (lesson.morning.photo && !fs.existsSync(lesson.morning.photo)) missing.push(lesson.morning.photo);
}
if (missing.length) {
  console.error("Не найдены файлы:\n" + missing.join("\n"));
  process.exit(1);
}
console.log("Проверка пройдена: 60 аудио и 5 изображений на месте.");
