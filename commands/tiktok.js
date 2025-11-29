import axios from "axios";

function cleanTitle(title) {
  return title.replace(/#[\w\d_]+/g, "").trim();
}

function formatNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return num.toString();
}

export default {
  pattern: "tt",
  alias: ["tdl", "tiktokdl", "tiktok", "ttdl"],
  category: "Owner",

  async function(conn, mek, m, ctx) {
    const { q } = ctx;
    const validUrlPattern =
      /https:\/\/(?:www\.)?tiktok\.com\/.*|https:\/\/vt\.tiktok\.com\/.*/;

    if (!q || !validUrlPattern.test(q)) {
      await m.react("❓");
      return m.reply("❓Please provide a valid TikTok video or image URL");
    }

    const response = await conn.sendMessage(
      ctx.from,
      { text: "📥 Fetching TikTok content..." },
      { quoted: mek }
    );

    try {
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(q)}`;
      const { data } = await axios.get(apiUrl);

      if (!data?.data) throw new Error("Failed to fetch TikTok data");

      const videoData = data.data;
      const clean_title = cleanTitle(videoData.title);

      if (videoData.images && videoData.images.length > 0) {
        // Image content
        await m.react("🖼️");

        const stats = `
📥 TikTok Downloader 📥

📌 Title: ${clean_title}

👤 Author: ${videoData.author.nickname}
▶️ Views: ${formatNumber(videoData.play_count)}
❤️ Likes: ${formatNumber(videoData.digg_count)}
💬 Comments: ${formatNumber(videoData.comment_count)}
🔄 Shares: ${formatNumber(videoData.share_count)}

⚡ 𝘚𝘛𝘙𝘌𝘈𝘔 𝘓𝘐𝘕𝘌 𝘔𝐃 (𝘝2) ⚡
        `.trim();

        await conn.sendMessage(ctx.from, { text: stats, edit: response.key });

        for (const img of videoData.images) {
          await conn.sendMessage(ctx.from, {
            image: { url: img },
            quoted: mek,
          });
        }
      } else {
        // Video content
        await m.react("🎬");

        const stats = `
📥 TikTok Downloader 📥

📌 Title: ${clean_title}

👤 Author: ${videoData.author.nickname}
▶️ Views: ${formatNumber(videoData.play_count)}
❤️ Likes: ${formatNumber(videoData.digg_count)}
💬 Comments: ${formatNumber(videoData.comment_count)}
🔄 Shares: ${formatNumber(videoData.share_count)}
⏱ Duration: ${videoData.duration}s

⚡ 𝘚𝘛𝘙𝘌𝘈𝘔 𝘓𝘐𝘕𝘌 𝘔𝐃 (𝘝2) ⚡
        `.trim();

        await conn.sendMessage(ctx.from, { text: stats, edit: response.key });

        await conn.sendMessage(ctx.from, {
          video: { url: videoData.play },
          quoted: mek,
        });
      }
    } catch (e) {
      console.log(e);
      m.react("❌");
      await conn.sendMessage(ctx.from, {
        text: "❌ Failed to fetch or send TikTok content. Try again later.",
        edit: response.key,
      });
    }
  },
};
