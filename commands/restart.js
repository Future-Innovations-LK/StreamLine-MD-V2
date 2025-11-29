export default {
  pattern: "restart",
  alias: ["reboot"],
  disc: "Restart the bot",
  category: "Owner",
  react: "🔁",

  async function(conn, mek, m, ctx) {
    const { isOwner } = ctx;

    if (!isOwner)
      return conn.sendMessage(
        ctx.from,
        {
          text: "❌ This command is owner-only.",
        },
        { quoted: mek }
      );

    await conn.sendMessage(
      ctx.from,
      {
        text: "♻️ Restarting bot....",
      },
      { quoted: mek }
    );

    setTimeout(() => process.exit(0), 1000);
  },
};
