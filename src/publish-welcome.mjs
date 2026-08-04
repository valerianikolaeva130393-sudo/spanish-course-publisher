import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const BOT_TOKEN = process.env.BOT_TOKEN?.trim();
const CHANNEL_ID = process.env.CHANNEL_ID?.trim();
const RUN_MODE = (process.env.RUN_MODE || "test").trim();

const WELCOME_IMAGE = path.join(ROOT, "images", "welcome-course.jpg");
const START_URL = "https://t.me/spanish_story_a1/27";

const WELCOME_TEXT = `🇪🇸 ¡Hola! Добро пожаловать в курс «Испанский через истории»
В этом канале вы будете изучать испанский с нуля вместе с Ясмин и Адрианом.
Каждый день вас ждут:
🌱 утром — новый эпизод, полезные фразы и аудио;
☀️ днём — практика и Telegram Poll.
Курс рассчитан на уровень A1–A2.
📚 Начинайте с Дня 1 и проходите уроки по порядку.
¡Buena suerte! 🇪🇸`;

function required(name, value) {
  if (!value) throw new Error(`Не задан ${name}`);
  return value;
}

async function telegram(method, body) {
  const response = await fetch(
    `https://api.telegram.org/bot${required("BOT_TOKEN", BOT_TOKEN)}/${method}`,
    {
      method: "POST",
      body,
    },
  );

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(
      `Telegram ${method}: ${data.description || `HTTP ${response.status}`}`,
    );
  }

  return data.result;
}

async function publishWelcome() {
  required("CHANNEL_ID", CHANNEL_ID);

  if (!fs.existsSync(WELCOME_IMAGE)) {
    throw new Error("Не найден файл images/welcome-course.jpg");
  }

  const form = new FormData();
  form.append("chat_id", CHANNEL_ID);
  form.append("photo", new Blob([fs.readFileSync(WELCOME_IMAGE)]), "welcome-course.jpg");
  form.append("caption", WELCOME_TEXT);
  form.append(
    "reply_markup",
    JSON.stringify({
      inline_keyboard: [
        [
          {
            text: "🚀 Начать обучение",
            url: START_URL,
          },
        ],
      ],
    }),
  );

  const message = await telegram("sendPhoto", form);

  console.log(`✓ Приветственный пост опубликован: message_id=${message.message_id}`);
  console.log(`✓ Кнопка ведёт на ${START_URL}`);

  if (RUN_MODE === "official") {
    const pinForm = new FormData();
    pinForm.append("chat_id", CHANNEL_ID);
    pinForm.append("message_id", String(message.message_id));
    pinForm.append("disable_notification", "true");

    await telegram("pinChatMessage", pinForm);
    console.log("✓ Приветственный пост закреплён без уведомления");
  } else {
    console.log("ℹ Режим test: сообщение опубликовано, но не закреплено");
  }
}

publishWelcome().catch((error) => {
  console.error(`ОШИБКА: ${error.message}`);
  process.exit(1);
});
