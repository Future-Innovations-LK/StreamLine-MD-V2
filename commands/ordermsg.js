import gifted from "gifted-btns";
const { sendInteractiveMessage } = gifted;

export default {
  pattern: "op",
  alias: ["orderpay"],
  desc: "Check bot speed",
  category: "Main",
  react: "⚡",

  async function(conn, mek, m, ctx) {
    const start = new Date().getTime();
    const responseTime = ((new Date().getTime() - start) / 1000).toFixed(2);

    await sendInteractiveMessage(
      conn,
      ctx.from,
      {
        // By nesting it inside interactiveMessage, we bypass the name validator
        interactiveMessage: {
          body: { text: `🔥 ℬ𝓞𝑇 𝓢𝓟𝓔𝓔𝓓: ${responseTime} ꌗ` },
          footer: { text: "Stream Line MD" },
          header: { title: "⚡ BOT PERFORMANCE", hasSubtitle: false },
          nativeFlowMessage: {
            buttons: [
              {
                name: "review_and_pay",
                buttonParamsJson: JSON.stringify({
                  reference_id: `id-${Date.now()}`,
                  type: "physical-goods",
                  payment_configuration: "manual_payment_configuration_id",
                  currencies: ["USD"],
                  total_amount: { value: 100, offset: 100 },
                  items: [
                    {
                      name: "Bot Speed Report",
                      amount: { value: 100, offset: 100 },
                      quantity: 1,
                    },
                  ],
                }),
              },
            ],
          },
        },
      },
      { quoted: mek },
    );
  },
};
