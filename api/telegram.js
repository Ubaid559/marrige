const { Telegraf } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply("أهلاً بك في بوت الزواج");
});

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(200).send("Bot is running");
  }

  try {
    await bot.handleUpdate(req.body);
    return res.status(200).send("OK");
  } catch (error) {
    console.error(error);
    return res.status(500).send("ERROR");
  }
};
