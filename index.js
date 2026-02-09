import express from "express";
import fetch from "node-fetch";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";

const app = express();
app.use(express.json());

/* ===== 환경변수 ===== */
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const ROBLOX_ENDPOINT = process.env.ROBLOX_ENDPOINT; 
const ROBLOX_SECRET = process.env.ROBLOX_SECRET;
const LOG_CHANNEL = process.env.LOG_CHANNEL;

/* ===== 디스코드 클라이언트 ===== */
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ===== 슬래시 명령 등록 ===== */
const commands = [
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("로블록스 유저 영구밴")
    .addStringOption(o =>
      o.setName("userid").setDescription("UserId").setRequired(true))
    .addStringOption(o =>
      o.setName("reason").setDescription("사유").setRequired(false)),
    
  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("로블록스 유저 밴 해제")
    .addStringOption(o =>
      o.setName("userid").setDescription("UserId").setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
await rest.put(
  Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
  { body: commands }
);

/* ===== 슬래시 명령 처리 ===== */
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === "ban") {
    const userId = i.options.getString("userid");
    const reason = i.options.getString("reason") || "No reason";

    await sendToRoblox({
      action: "ban",
      userId,
      reason
    });

    await i.reply(`✅ **BAN 완료**\nUserId: ${userId}\n사유: ${reason}`);
  }

  if (i.commandName === "unban") {
    const userId = i.options.getString("userid");

    await sendToRoblox({
      action: "unban",
      userId
    });

    await i.reply(`♻️ **UNBAN 완료**\nUserId: ${userId}`);
  }
});

/* ===== Roblox로 명령 전달 ===== */
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

/* ===== Roblox → Render 로그 수신 ===== */
app.post("/log", async (req, res) => {
  const log = req.body;

  const channel = await client.channels.fetch(LOG_CHANNEL);
  if (channel) {
    channel.send("```json\n" + JSON.stringify(log, null, 2) + "\n```");
  }

  res.send("OK");
});

/* ===== 서버 ===== */
app.listen(3000, () => console.log("Render server running"));

client.login(DISCORD_TOKEN);