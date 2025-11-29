//lib/loader.js
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

export async function loadPlugins() {
  const pluginsDir = path.join(process.cwd(), "commands");
  const files = fs.readdirSync(pluginsDir).filter((f) => f.endsWith(".js"));
  const plugins = {};

  for (const file of files) {
    const filePath = path.join(pluginsDir, file);
    const fileUrl = pathToFileURL(filePath).href;

    const plug = await import(fileUrl);
    plugins[file] = plug.default || plug;
  }

  return plugins;
}
