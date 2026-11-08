const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER = process.env.OWNER_TELEGRAM_ID;
const CHANNEL = process.env.TELEGRAM_CHANNEL_ID;

const inventory = [
  "ODLR Bella Blanca 3.4 oz — $55",
  "Oscar Bella Rosa (L) — $55",
  "Lacoste Touch of Pink 3 oz — $65",
  "Escada Sorbetto Rosso 3.4 oz — $60",
  "Burberry Brit Sheer (L) 3.3 oz — $70",
  "Versace Eros Femme 3.4 oz — $95",
  "Versace Bright Crystal Absolu — $105",
  "Hugo Boss Femme 2.5 oz — $65",
  "Montblanc Signature for Her 3 oz — $80",
  "Michael Kors Sexy Amber 3.4 oz — $75",
  "Michael Kors Gorgeous! 3.4 oz — $75",
  "Jimmy Choo Illicit (L) 3.4 oz — $80",
  "Coach New York 3.4 oz — $100",
  "Curve Pink Blossom (L) 3.4 oz — $35",
  "Curve Chill (L) 3.4 oz — $30",
  "Narciso Rodriguez (L) 3-Piece Set — $120",
  "Ariana Grande Cloud Pink (L) — $75",
  "Valentino Uomo Born in Roma 3.4 oz — $120",
  "Carolina Herrera Bad Boy 3.4 oz — $110",
  "Jimmy Choo Man Intense 3.4 oz — $85",
  "Burberry Touch for Men 3.3 oz — $65",
  "Gucci Guilty for Men 3 oz — $100",
  "Azzaro Wanted 3.4 oz — $85"
];

async function telegram(method, data) {
  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }
  );

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.description || "Telegram API error");
  }

  return result;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  if (!TOKEN || !OWNER || !CHANNEL) {
    return res.status(500).send("Bot environment variables are missing");
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    secret &&
    req.headers["x-telegram-bot-api-secret-token"] !== secret
  ) {
    return res.status(401).send("Unauthorized");
  }

  try {
    const update = req.body;

    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = String(message.from.id);
      const text = (message.text || "").trim();

      if (userId !== OWNER) {
        await telegram("sendMessage", {
          chat_id: chatId,
          text: "Sorry, this bot is private."
        });
        return res.status(200).send("OK");
      }

      if (text === "/start") {
        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            "🖤 WELCOME TO LUXURY FRAGRANCE\n\n" +
            "/inventory — View your fragrance catalog\n" +
            "/post — Prepare a channel post\n\n" +
            "To prepare a post, send:\n" +
            "/post Product | Price | Description\n\n" +
            "You must approve every post before it goes live."
        });
      } else if (text === "/inventory") {
        await telegram("sendMessage", {
          chat_id: chatId,
          text: "🖤 LUXURY FRAGRANCE CATALOG\n\n" +
            inventory.map((item, i) => `${i + 1}. ${item}`).join("\n")
        });
      } else if (text === "/post" || text.startsWith("/post ")) {
        const details = text.replace(/^\/post\s*/, "");
        const parts = details.split("|").map(part => part.trim());

        if (parts.length < 2 || !parts[0] || !parts[1]) {
          await telegram("sendMessage", {
            chat_id: chatId,
            text:
              "Use this format:\n\n" +
              "/post Product Name | Price | Description\n\n" +
              "Example:\n" +
              "/post Valentino Born in Roma | $120 | 3.4 oz"
          });
        } else {
          const product = parts[0];
          const price = parts[1];
          const description = parts.slice(2).join(" | ");

          const preview =
            "🖤 LUXURY FRAGRANCE 🖤\n\n" +
            `${product}\n` +
            `Price: ${price}\n` +
            (description ? `${description}\n` : "") +
            "\nMessage us to purchase.";

          await telegram("sendMessage", {
            chat_id: chatId,
            text: "PREVIEW — APPROVAL REQUIRED\n\n" + preview,
            reply_markup: {
              inline_keyboard: [[
                { text: "✅ APPROVE & POST", callback_data: "approve_post" },
                { text: "❌ CANCEL", callback_data: "cancel_post" }
              ]]
            }
          });
        }
      } else {
        await telegram("sendMessage", {
          chat_id: chatId,
          text: "Command not recognized. Try /start."
        });
      }
    }

    if (update.callback_query) {
      const callback = update.callback_query;
      const userId = String(callback.from.id);

      if (userId !== OWNER) {
        await telegram("answerCallbackQuery", {
          callback_query_id: callback.id,
          text: "Not authorized."
        });
        return res.status(200).send("OK");
      }

      if (callback.data === "approve_post") {
        const preview = callback.message.text.replace(
          "PREVIEW — APPROVAL REQUIRED\n\n",
          ""
        );

        await telegram("sendMessage", {
          chat_id: CHANNEL,
          text: preview
        });

        await telegram("answerCallbackQuery", {
          callback_query_id: callback.id,
          text: "Your post is live!"
        });

        await telegram("editMessageText", {
          chat_id: callback.message.chat.id,
          message_id: callback.message.message_id,
          text: "✅ POST PUBLISHED\n\n" + preview
        });
      } else if (callback.data === "cancel_post") {
        await telegram("answerCallbackQuery", {
          callback_query_id: callback.id,
          text: "Post cancelled."
        });

        await telegram("editMessageText", {
          chat_id: callback.message.chat.id,
          message_id: callback.message.message_id,
          text: "❌ POST CANCELLED"
        });
      }
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Telegram bot error:", error);
    return res.status(200).send("Handled");
  }
}
