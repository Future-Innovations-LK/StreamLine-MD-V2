//commands/ping.js
export default {
  pattern: "ping",
  alias: ["p"],
  disc: "Check bot speed",
  category: "Main",
  react: "⚡",

  async function(conn, mek, m, ctx) {
    const start = new Date().getTime();

    // Send initial ping message
    const response = await conn.sendMessage(
      ctx.from,
      { text: "Pinging..." },
      { quoted: mek }
    );

    const end = new Date().getTime();
    const responseTime = (end - start) / 1000;

    // Edit the previous message
    await conn.sendMessage(ctx.from, {
      text: `🔥 ℬ𝓞𝑇 𝓢𝓟𝓔𝓔𝓓:  ${responseTime.toFixed(2)} ꌗ`,
      edit: response.key,
    });
  },
};
