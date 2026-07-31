import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const missing = [];
const errors = [];

function expectFile(relativePath) {
  const full = path.join(ROOT, relativePath);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) missing.push(relativePath);
}

for (let day = 1; day <= 30; day += 1) {
  const name = `day${String(day).padStart(2, "0")}.mp3`;
  expectFile(path.join("audio", "morning", name));
  expectFile(path.join("audio", "practice", name));
}

for (const day of [7, 14, 21, 28, 30]) {
  expectFile(path.join("images", `day${String(day).padStart(2, "0")}.jpg`));
}

expectFile(path.join("data", "lessons.json"));
expectFile(path.join("data", "state.json"));
expectFile(path.join("src", "publish.mjs"));

try {
  const lessons = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "lessons.json"), "utf8"));
  if (!Array.isArray(lessons) || lessons.length !== 30) {
    errors.push("data/lessons.json должен содержать ровно 30 дней");
  } else {
    for (let day = 1; day <= 30; day += 1) {
      const item = lessons.find(entry => entry.day === day);
      if (!item) errors.push(`В lessons.json отсутствует День ${day}`);
      for (const slot of ["morning", "practice"]) {
        if (!item?.[slot]?.text) errors.push(`Нет текста: День ${day}, ${slot}`);
        if (!item?.[slot]?.audio) errors.push(`Нет аудио-пути: День ${day}, ${slot}`);
      }
    }
    const day29 = lessons.find(entry => entry.day === 29)?.practice?.text || "";
    if (!day29.includes("Vivo en")) errors.push("В практике Дня 29 отсутствует фраза Vivo en…");
  }
} catch (error) {
  errors.push(`Не удалось прочитать lessons.json: ${error.message}`);
}

if (missing.length) {
  console.error("\nНе найдены файлы:");
  for (const file of missing) console.error(`  - ${file}`);
}
if (errors.length) {
  console.error("\nОшибки данных:");
  for (const error of errors) console.error(`  - ${error}`);
}

if (missing.length || errors.length) process.exit(1);

console.log("✓ Найдено 30 утренних MP3");
console.log("✓ Найдено 30 дневных MP3");
console.log("✓ Найдено 5 изображений");
console.log("✓ lessons.json содержит 30 дней");
console.log("✓ В практике Дня 29 есть Vivo en…");
console.log("✓ Проверка завершена успешно");
