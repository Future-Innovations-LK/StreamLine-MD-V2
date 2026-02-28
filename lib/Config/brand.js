import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// adjust this path to where your JSON actually is relative to THIS file
const brandPath = path.join(__dirname, "../../bot.config.json");

function loadBrand() {
  const raw = fs.readFileSync(brandPath, "utf-8");
  const brand = JSON.parse(raw);

  if (!brand?.branding?.logo) console.warn("brand.json missing branding.logo");
  if (!brand?.urls?.github) console.warn("brand.json missing urls.github");

  return brand;
}

export function reloadBrand() {
  return loadBrand();
}

export default loadBrand();
