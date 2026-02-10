import express from "express";
import fetch from "node-fetch";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes
} from "discord.js";

const app = express();
app.use(express.json());

/* ===== ENV ===== */
const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  ROBLOX_ENDPOINT,
  ROBLOX_SECRET,
  LOG_CHANNEL
} = process.env;

/* ===== DISCORD ===== */
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ===== SLASH COMMANDS (안전 JSON 직접 작성) ===== */
const commands = [
  {
    name: "ban",
    description: "ban roblox user",
    options: [
      {
        name: "userid",
        description: "roblox userid",
        type: 3,
        required: true
      },
      {
        name: "reason",
        description: "ban reason",
        type: 3,
        required: false
      }
    ]
  },
  {
    name: "unban",
    description: "unban roblox user",
    options: [
      {
        name: "userid",
        description: "roblox userid",
        type: 3,
        required: true
      }
    ]
  }
];

/* ===== REGISTER COMMANDS (한 번만 실행) ===== */
async function registerCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Slash commands registered");
  } catch (e) {
    console.error("Slash register error:", e);
  }
}
registerCommands();

/* ===== INTERACTIONS ===== */
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === "ban") {
    const userId = i.options.getString("userid");
    const reason = i.options.getString("reason") || "No reason";

    await sendToRoblox({ action: "ban", userId, reason });
    await i.reply(`BAN 완료: ${userId}`);
  }

  if (i.commandName === "unban") {
    const userId = i.options.getString("userid");

    await sendToRoblox({ action: "unban", userId });
    await i.reply(`UNBAN 완료: ${userId}`);
  }
});

/* ===== SEND TO ROBLOX ===== */
async function sendToRoblox(data) {
  await fetch(ROBLOX_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Roblox-Secret": ROBLOX_SECRET
    },
    body: JSON.stringify(data)
  });
}

/* ===== ROBLOX → DISCORD LOG ===== */
app.post("/log", async (req, res) => {
  try {
    const channel = await client.channels.fetch(LOG_CHANNEL);
    if (channel) {
      channel.send("```json\n" + JSON.stringify(req.body, null, 2) + "\n```");
    }
  } catch {}
  res.send("OK");
});

/* ===== SERVER ===== */
app.listen(3000, () => console.log("Render server running"));
client.login(DISCORD_TOKEN);