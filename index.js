import express from "express";
import fetch from "node-fetch";
import { Client, GatewayIntentBits, REST, Routes } from "discord.js";

const app = express();
app.use(express.json({ limit: "100kb" }));

/* ===== ENV 검증 ===== */
const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  ROBLOX_ENDPOINT,
  ROBLOX_SECRET,
  LOG_CHANNEL,
  PORT = 3000
} = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID || !ROBLOX_ENDPOINT || !ROBLOX_SECRET || !LOG_CHANNEL) {
  console.error("Missing required environment variables. Exiting.");
  process.exit(1);
}

/* ===== DISCORD 클라이언트 ===== */
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/* ===== 슬래시 커맨드 정의 (숫자 타입 사용) ===== */
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

/* ===== 명령어 등록 (한 번만 실행) ===== */
async function registerCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("Slash commands registered");
  } catch (e) {
    console.error("Slash register error:", e);
  }
}
registerCommands();

/* ===== 상수/유틸 ===== */
const MAX_RETRIES = 2;
async function postWithRetry(url, opts, retries = 0) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res;
  } catch (err) {
    if (retries < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 200 * (retries + 1)));
      return postWithRetry(url, opts, retries + 1);
    }
    throw err;
  }
}

/* ===== 상호작용 처리 ===== */
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "ban") {
      const userId = interaction.options.getString("userid");
      const reason = interaction.options.getString("reason") || "No reason";
      await sendToRoblox({ action: "ban", userId, reason });
      await interaction.reply({ content: `BAN 완료: ${userId}`, ephemeral: true });
    } else if (interaction.commandName === "unban") {
      const userId = interaction.options.getString("userid");
      await sendToRoblox({ action: "unban", userId });
      await interaction.reply({ content: `UNBAN 완료: ${userId}`, ephemeral: true });
    }
  } catch (err) {
    console.error("Interaction error:", err);
    try { await interaction.reply({ content: "오류가 발생했습니다.", ephemeral: true }); } catch {}
  }
});

/* ===== Roblox로 전송 ===== */
async function sendToRoblox(data) {
  if (!data || typeof data !== "object") throw new Error("Invalid payload");
  const body = JSON.stringify(data);
  await postWithRetry(ROBLOX_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Roblox-Secret": ROBLOX_SECRET
    },
    body
  });
}

/* ===== Roblox → Discord 로그 엔드포인트 ===== */
app.post("/log", async (req, res) => {
  try {
    const payload = req.body;
    // 간단한 유효성 검사
    if (!payload || typeof payload !== "object") {
      return res.status(400).send("Bad Request");
    }
    const channel = await client.channels.fetch(LOG_CHANNEL).catch(() => null);
    if (channel && channel.isTextBased && channel.send) {
      const text = "```json\n" + JSON.stringify(payload, null, 2) + "\n```";
      await channel.send({ content: text }).catch(err => console.error("Send log error:", err));
    } else {
      console.warn("Log channel not available");
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error("Log endpoint error:", err);
    res.status(500).send("ERR");
  }
});

/* ===== 기본 헬스체크 ===== */
app.get("/health", (req, res) => res.send({ ok: true, ts: Date.now() }));

/* ===== 서버 시작 및 디스코드 로그인 ===== */
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
client.login(DISCORD_TOKEN).catch(err => {
  console.error("Discord login failed:", err);
  process.exit(1);
});