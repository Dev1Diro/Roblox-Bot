import express from "express";
import fs from "fs";
import bans from "./bans.js";
import { Client, GatewayIntentBits, REST, Routes } from "discord.js";

const app = express();
app.use(express.json({ limit: "100kb" }));

const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  ROBLOX_SECRET,
  LOG_CHANNEL,
  PORT = 3000
} = process.env;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// bans.js 업데이트 함수
function saveBans() {
  fs.writeFileSync("./bans.js", "module.exports = " + JSON.stringify(bans, null, 2));
}

function addBan(userId, reason, source) {
  bans.push({ userId, reason, source, time: Date.now() });
  saveBans();
}

function removeBan(userId) {
  const idx = bans.findIndex(b => b.userId == userId);
  if (idx !== -1) {
    bans.splice(idx, 1);
    saveBans();
  }
}

// Discord Slash 명령어 등록
const commands = [
  {
    name: "ban",
    description: "ban roblox user",
    options: [
      { name: "userid", description: "roblox userid", type: 3, required: true },
      { name: "reason", description: "ban reason", type: 3, required: false }
    ]
  },
  {
    name: "unban",
    description: "unban roblox user",
    options: [
      { name: "userid", description: "roblox userid", type: 3, required: true }
    ]
  }
];

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
}
registerCommands();

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "ban") {
    const userId = interaction.options.getString("userid");
    const reason = interaction.options.getString("reason") || "No reason";
    addBan(userId, reason, "Discord");
    await interaction.reply({ content: `BAN 기록됨: ${userId}`, ephemeral: true });
  } else if (interaction.commandName === "unban") {
    const userId = interaction.options.getString("userid");
    removeBan(userId);
    await interaction.reply({ content: `UNBAN 기록됨: ${userId}`, ephemeral: true });
  }
});

// Roblox 서버에서 ban 여부 확인
app.post("/checkban", (req, res) => {
  const { userId } = req.body;
  const found = bans.find(b => b.userId == userId);
  if (found) {
    res.json({ banned: true, reason: found.reason });
  } else {
    res.json({ banned: false });
  }
});

// Roblox 서버에서 채팅 로그 전송 → Discord 채널에 출력
app.post("/chatlog", async (req, res) => {
  const { userId, name, message } = req.body;
  const channel = await client.channels.fetch(LOG_CHANNEL).catch(() => null);
  if (channel && channel.isTextBased()) {
    await channel.send(`[CHAT] ${name} (${userId}): ${message}`);
  }
  res.send("OK");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
client.login(DISCORD_TOKEN);