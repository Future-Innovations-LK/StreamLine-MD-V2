import express from "express";
import { connectToWA } from "./waBot.js";
import { handleMessage } from "./messageHandler.js";

const app = express();
const port = process.env.PORT || 5035;

app.get("/", (req, res) => res.send("Bot started ✅"));
app.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`)
);

setTimeout(async () => {
  const conn = await connectToWA();
}, 4000);
