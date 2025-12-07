export default {
  pattern: "restart",
  alias: ["reboot", "res"],
  disc: "Restart the bot",
  category: "Owner",
  react: "🔁",

  async function(conn, mek, m, ctx) {
    const { isOwner } = ctx;

    if (!isOwner) {
      m.react("❌");
      conn.sendMessage(
        ctx.from,
        {
          text: "❌ only the owner can restart the bot.",
        },
        { quoted: mek }
      );
      return;
    }

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
