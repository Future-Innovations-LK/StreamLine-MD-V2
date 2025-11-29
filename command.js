// command.js
export async function loadAllCommands() {
  const { loadPlugins } = await import("./lib/loader.js");
  const plugins = await loadPlugins();

  return Object.values(plugins)
    .map((plugin) => plugin.default || plugin)
    .filter(Boolean)
    .map((cmd) => ({
      pattern: cmd.pattern,
      alias: cmd.alias || [],
      disc: cmd.disc || "",
      category: cmd.category || "Misc",
      react: cmd.react || null,
      function: cmd.function,
    }));
}

// Menu generator
export async function generateCommandMenu() {
  const commands = await loadAllCommands();

  const categories = {};
  commands.forEach((cmd) => {
    const cat = cmd.category || "Misc";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(cmd);
  });

  let menuText = "📜 *COMMAND MENU*\n\n";
  for (const cat in categories) {
    menuText += `*${cat}*\n`;
    menuText +=
      categories[cat]
        .map(
          (c) =>
            `• ${c.pattern}${
              c.alias.length ? ` (alias: ${c.alias.join(", ")})` : ""
            }${c.react ? ` ${c.react}` : ""}`
        )
        .join("\n") + "\n\n";
  }

  return menuText.trim();
}
