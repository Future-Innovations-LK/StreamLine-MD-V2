import os from "os";
import process from "process";

function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

export default {
  pattern: "system",
  alias: ["sys", "status"],
  disc: "Show system info",
  category: "Utilities",
  react: "💻",

  async function(conn, mek, m, ctx) {
    const { isOwner, isGroup, botJid } = ctx;

    const start = Date.now();

    const msg = await conn.sendMessage(
      ctx.from,
      { text: "⌛ Fetching system data..." },
      { quoted: mek }
    );

    const ping = ((Date.now() - start) / 1000).toFixed(2);

    // ---- BASIC INFO (Everyone) ----
    const uptime = formatUptime(process.uptime());
    const platform = `${os.platform()} ${os.arch()}`;
    const totalRam = formatBytes(os.totalmem());
    const usedRam = formatBytes(process.memoryUsage().rss);

    let text = `
💻 *BOT STATUS*

⚡ *Ping:* ${ping}s
⏱️ *Uptime:* ${uptime}
💾 *RAM Used:* ${usedRam}
🗄️ *Total RAM:* ${totalRam}
`.trim();

    // ---- ADVANCED INFO (OWNER ONLY) ----
    if (isOwner) {
      const hostname = os.hostname();
      const freeRam = formatBytes(os.freemem());

      const cpu = os.cpus()[0].model;
      const cores = os.cpus().length;

      const cpuUsage = process.cpuUsage();
      const cpuUser = (cpuUsage.user / 1000000).toFixed(2);
      const cpuSys = (cpuUsage.system / 1000000).toFixed(2);

      const node = process.version;
      const pid = process.pid;

      text += `

━━━━━━━━━━━━━━━
🔒 *OWNER MODE*

📱 *Platform:* ${platform}
🖥️ *Hostname:* ${hostname}

🧠 *CPU:* ${cpu}
🔢 *Cores:* ${cores}

🔥 *CPU Usage:*  
• User: ${cpuUser}s  
• System: ${cpuSys}s  

💾 *Free RAM:* ${freeRam}

🆔 *Bot JID:* ${botJid}
🆔 *PID:* ${pid}
🟢 *Node:* ${node}
🏠 *Command From Group:* ${isGroup ? "Yes" : "No"}
`;
    }

    // edit msg
    await conn.sendMessage(ctx.from, {
      text: text,
      edit: msg.key,
    });
  },
};
