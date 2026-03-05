/*import axios from "axios";
import FormData from "form-data";
import fetch from "node-fetch";

export default {
  pattern: "test",
  alias: ["p"],
  disc: "Check bot speed and test card API",
  category: "Main",
  react: "⚡",

  async function(conn, mek, m, ctx) {
    const start = Date.now();

    try {
      const senderJid = m.sender;

      // ---- Push name ----
      const displayName = m.pushName || "Unknown User";

      // ---- Phone number ----
      const phone = senderJid.split("@")[0];

      // ---- Group name (if in group) ----
      let groupName = "Private Chat";
      if (ctx.isGroup) {
        const meta = await conn.groupMetadata(ctx.from);
        groupName = meta.subject;
      }

      // ---- Theme (example) ----
      const themeKey = "default";

      // ---- Fetch sender profile picture ----
      let avatarBuffer;
      try {
        const avatarUrl = await conn.profilePictureUrl(senderJid, "image");
        const avatarResp = await fetch(avatarUrl);
        avatarBuffer = await avatarResp.buffer();
      } catch {
        // fallback image if user has no profile pic
        const fallbackUrl = "https://img.pyrocdn.com/dbKUgahg.png";
        const fallbackResp = await fetch(fallbackUrl);
        avatarBuffer = await fallbackResp.buffer();
      }

      // ---- FormData ----
      const form = new FormData();
      form.append("profile", avatarBuffer, { filename: "avatar.png" });
      form.append("name", displayName);
      form.append("phone", phone);
      form.append("groupName", groupName);
      form.append("themeKey", themeKey);

      // ---- API call ----
      const apiResponse = await axios.post(
        "http://localhost:3000/generate-card",
        form,
        {
          headers: form.getHeaders(),
          responseType: "arraybuffer",
        }
      );

      const responseTime = (Date.now() - start) / 1000;

      await conn.sendMessage(
        ctx.from,
        {
          image: Buffer.from(apiResponse.data),
          caption: `🔥 ℬ𝓞𝑇 𝓢𝓟𝓔𝓔𝓓: ${responseTime.toFixed(
            2
          )}s\nCard generated for *${displayName}*`,
        },
        { quoted: mek }
      );
    } catch (err) {
      console.error(err);
      await conn.sendMessage(
        ctx.from,
        { text: "❌ Failed to generate card." },
        { quoted: mek }
      );
    }
  },
};
*/

import gifted from "gifted-btns";
const { sendInteractiveMessage } = gifted;

export default {
  pattern: "test",
  alias: ["btn"],
  desc: "Test gifted-btns features",
  category: "Dev",

  function: async (conn, mek, m, ctx) => {
    const jid = mek.key.remoteJid;
    const flag = ctx.q?.toLowerCase()?.trim();

    let buttons = [];

    switch (flag) {
      case "c":
      case "copy":
        buttons = [
          {
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
              display_text: "Copy Code",
              copy_code: "STREAMLINE-123",
            }),
          },
        ];
        break;

      case "u":
      case "url":
        buttons = [
          {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "Open Website",
              url: "https://futureinnovations.lk",
            }),
          },
        ];
        break;

      case "call":
        buttons = [
          {
            name: "cta_call",
            buttonParamsJson: JSON.stringify({
              display_text: "Call Support",
              phone_number: "+94713829670",
            }),
          },
        ];
        break;

      case "qr":
      case "quick":
        buttons = [
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "Hello Bot",
              id: "hello_test",
            }),
          },
        ];
        break;

      case "list":
        buttons = [
          {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "Choose an option",
              sections: [
                {
                  title: "Test Options",
                  rows: [
                    {
                      id: "opt_1",
                      title: "Option 1",
                      description: "First test option",
                    },
                    {
                      id: "opt_2",
                      title: "Option 2",
                      description: "Second test option",
                    },
                  ],
                },
              ],
            }),
          },
        ];
        break;

      case "loc":
      case "location":
        buttons = [
          {
            name: "send_location",
            buttonParamsJson: JSON.stringify({
              display_text: "Share Location",
            }),
          },
        ];
        break;

      case "all":
      default:
        buttons = [
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "Ping",
              id: "ping_test",
            }),
          },
          {
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
              display_text: "Copy Code",
              copy_code: "STREAMLINE",
            }),
          },
          {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "Visit Site",
              url: "https://futureinnovations.lk",
            }),
          },
          {
            name: "cta_call",
            buttonParamsJson: JSON.stringify({
              display_text: "Call Me",
              phone_number: "+94713829670",
            }),
          },
          {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "Select Test",
              sections: [
                {
                  title: "Choices",
                  rows: [
                    { id: "a", title: "Alpha" },
                    { id: "b", title: "Beta" },
                  ],
                },
              ],
            }),
          },
        ];
    }

    await sendInteractiveMessage(conn, jid, {
      text: `🧪 Button Test: ${flag || "all"}`,
      footer: "StreamLine MD V2 Testing",
      interactiveButtons: buttons,
    });
  },
};
