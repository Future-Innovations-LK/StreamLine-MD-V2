import btch from "btch-downloader";
const { yts, youtube } = btch;
import { registerReply } from "../lib/replyStore.js";

export default {
  pattern: "play",
  alias: ["yt", "mp3", "mp4", "ytdl"],
  category: "Download",
  react: "🎵",

  async function(conn, mek, m, ctx) {
    const { q } = ctx;
    if (!q) {
      m.react("❓");
      m.reply("❓ Please provide a YouTube search query or a URL.");
      return;
    }

    try {
      const isUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(q);
      let meta;

      if (isUrl) {
        // Direct URL: fetch metadata
        console.log(`[INFO] Fetching metadata for URL: ${q}`);
        meta = await youtube(q);
        if (!meta) throw new Error("Failed to fetch metadata for URL.");

        await sendDownloadMenu(meta, conn, mek, ctx);
      } else {
        // Search query: use yts
        console.log(`[INFO] Searching YouTube for query: ${q}`);
        const res = await yts(q);
        const searchResults = res?.result?.all?.slice(0, 10) || [];

        if (searchResults.length === 0) {
          return conn.sendMessage(ctx.from, { text: "❌ No results found." });
        }

        // Build search results list with duration and views
        let listMsg = "🔍 Search results:\n\n";
        searchResults.forEach((video, i) => {
          const duration = video.timestamp || "N/A";
          const views = video.views ? video.views.toLocaleString() : "N/A";
          listMsg += `${i + 1}. ${
            video.title
          } (${duration}) — 👀 ${views} views\n`;
        });
        listMsg += "\nReply with the number of the video you want to download.";

        const sentMsg = await conn.sendMessage(
          ctx.from,
          { text: listMsg },
          { quoted: mek }
        );

        // Register reply handler for selection
        registerReply(sentMsg.key.id, {
          command: "play_select",
          async onReply(text, ctx2) {
            const choice = parseInt(text.trim());
            if (!choice || choice < 1 || choice > searchResults.length) {
              return m.reply("❌ Invalid choice. Reply with a valid number.");
            }

            try {
              meta = await youtube(searchResults[choice - 1].url);
              if (!meta) throw new Error("Failed to fetch video metadata.");

              // Merge yts info for duration/views/likes
              const ytsMeta = searchResults[choice - 1];
              meta.duration = ytsMeta.timestamp || meta.duration || "N/A";
              meta.views = ytsMeta.views || meta.views || 0;
              meta.likes = ytsMeta.likes || 0;

              await sendDownloadMenu(meta, conn, mek, ctx2);
            } catch (err) {
              console.error("[ERROR] Fetching selected video metadata:", err);
              m.reply("❌ Failed to fetch video metadata.");
            }
          },
        });
      }
    } catch (err) {
      console.error("[ERROR] Processing request:", err);
      m.reply("❌ Failed to process your request. See logs for details.");
    }
  },
};

async function sendDownloadMenu(meta, conn, mek, ctx) {
  const title = meta.title || "Unknown Title";
  const author = meta.author || "Unknown";
  const duration = meta.duration || "N/A";
  const views = meta.views ? meta.views.toLocaleString() : "N/A";
  const likes = meta.likes ? meta.likes.toLocaleString() : "N/A";

  if (!meta.mp3 && !meta.mp4) {
    return mek.reply("❌ Unable to fetch download links for this video.");
  }

  const info = `🎵 *${title}* 🎵
👤 Author: ${author}
⏳ Duration: ${duration}
👀 Views: ${views}
👍 Likes: ${likes}

Reply with download type:
1️⃣ Audio (stream)
2️⃣ Video (stream)
3️⃣ Document Audio
4️⃣ Document Video`;

  try {
    const typeMsg = await conn.sendMessage(
      ctx.from,
      { image: { url: meta.thumbnail }, caption: info },
      { quoted: mek }
    );

    registerReply(typeMsg.key.id, {
      command: "play_download",
      async onReply(text, ctx2) {
        const choice = text.trim();
        try {
          if (choice === "1" && meta.mp3) {
            await conn.sendMessage(
              ctx2.from,
              { audio: { url: meta.mp3, mimetype: "audio/mpeg" } },
              { quoted: mek }
            );
          } else if (choice === "2" && meta.mp4) {
            await conn.sendMessage(
              ctx2.from,
              { video: { url: meta.mp4, mimetype: "video/mp4" } },
              { quoted: mek }
            );
          } else if (choice === "3" && meta.mp3) {
            await conn.sendMessage(
              ctx2.from,
              {
                document: { url: meta.mp3 },
                mimetype: "audio/mpeg",
                caption: title,
              },
              { quoted: mek }
            );
          } else if (choice === "4" && meta.mp4) {
            await conn.sendMessage(
              ctx2.from,
              {
                document: { url: meta.mp4 },
                mimetype: "video/mp4",
                caption: title,
              },
              { quoted: mek }
            );
          } else {
            return mek.reply(
              "❌ Invalid choice or unavailable media. Reply with 1-4."
            );
          }
          await conn.sendMessage(ctx2.from, { text: "✅ Download sent!" });
        } catch (err) {
          console.error("[ERROR] Sending media:", err);
          mek.reply("❌ Failed to send media.");
        }
      },
    });
  } catch (err) {
    console.error("[ERROR] Sending download menu:", err);
    mek.reply("❌ Failed to show download options.");
  }
}
