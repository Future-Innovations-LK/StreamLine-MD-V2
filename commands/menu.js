import { generateCommandMenu } from "../command.js";

export default {
  pattern: "menu",
  react: "📋",
  category: "Main",

  async function(conn, mek, m, ctx) {
    const menu = await generateCommandMenu();

    await conn.sendMessage(ctx.from, { text: menu }, { quoted: mek });
  },
};
