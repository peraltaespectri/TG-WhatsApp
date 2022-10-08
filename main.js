const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const { Telegraf } = require("telegraf");
const config = require("./config");
const { Markup } = require("telegraf");
const handleMessage = require("./helpers/handleMessage");
const handleTgBot = require("./helpers/handleTG");
const { database, pmEnabled, cachedData } = require("./db");
const { clean } = require("./session/manage");

const bot = new Telegraf(config.telegramBotToken);

const client = new Client({
  puppeteer: { headless: true, args: ["--no-sandbox"] },
  authStrategy: new LocalAuth({ clientId: "whatsbot" }),
});

client.on("auth_failure", () => {
  console.error(
    "Há um problema na autenticação, por favor, defina o env var novamente e reinicie o aplicativo"
  );
  client.tgbot.telegram.sendMessage(
    config.ownerID,
    "#ERRO\nHá um problema na autenticação, por favor, defina o env var novamente e reinicie o aplicativo"
  );
});

client.on("ready", () => {
  console.log("WhatsApp Bot Foi iniciado!");
  bot.launch();
  console.log("Telegram Bot Foi iniciado!");
});

client.on("message", async (msg) => {
  if (msg.body.startsWith("!connect")) {
    const whatsAppChat = await msg.getChat();
    if (whatsAppChat.isGroup) {
      const chatID = msg.body.split("!connect ")[1].trim();
      try {
        var { conn, coll } = await database("connections");
        const data = await coll.findOne({
          tgID: chatID,
          whatsAppID: whatsAppChat.id._serialized.toString(),
        });
        if (data) {
          return await msg.reply(`Já conectado a um Bate-Papo! ${data.tgID}.`);
        }
      } catch (error) {
        console.log(error);
      } finally {
        if (conn) {
          await conn.close();
        }
      }
      const keyboard = Markup.inlineKeyboard([
        Markup.button.callback("Conectar", whatsAppChat.id._serialized),
      ]);
      await msg.reply(
        "A Solicitação de conexão foi enviada. Esperando Aprovação!"
      );
      client.tgbot.telegram.sendMessage(
        chatID,
        `${msg.author} \nQuer conectar este Grupo Com o Grupo do Whatsapp \n${whatsAppChat.name}`,
        keyboard
      );
    }
  }

  await handleMessage(msg, client.tgbot, client);
});

client.on("message_revoke_everyone", async (after, before) => {
  if (before) {
    // TODO handle deleted messages on telegram | TODO lida com mensagens apagadas no telegrama
    // console.log("Deleted message");
  }
});

client.on("disconnected", (reason) => {
  console.log("Client was logged out", reason);
  client.tgbot.telegram.sendMessage(
    config.ownerID,
    `O cliente WhatsApp foi desconectado.\nReason ${reason}`
  );
});

client.on("qr", (qr) => {
  console.log(`A sessão expirou. Gere um novo arquivo de sessão!\n`);
  client.tgbot.telegram.sendMessage(
    config.ownerID,
    "Sessão expirada / não encontrada, faça login e configure a sessão novamente!"
  );
  clean();
  process.exit();
});

// tg bot commands

bot.command("connect", (ctx) => {
  if (["group", "supergroup"].includes(ctx.chat.type)) {
    ctx.reply(
      `Envie \n<code>!connect ${ctx.chat.id}</code> \nem seu grupo do WhatsApp.`,
      { parse_mode: "HTML" }
    );
  }
});

bot.on("callback_query", async (ctx) => {
  if (ctx.callbackQuery.from.id.toString() == config.ownerID.toString()) {
    const queryData = ctx.callbackQuery.data;
    let waChatID, tgID, chatTitle;
    if (queryData.startsWith("pm")) {
      waChatID = queryData.split(" ")[1].trim();
      let value;
      if (queryData.startsWith("pmEnable")) {
        value = "true";
      } else {
        value = "false";
      }
      try {
        var { conn, coll } = await database("pmlog");
        await coll.updateOne(
          { chatID: waChatID },
          { $set: { status: value } },
          { upsert: true }
        );
        pmEnabled.set(waChatID, value);
      } catch (error) {
        console.log(error);
      } finally {
        if (conn) {
          await conn.close();
        }
      }
      if (value == "true") {
        await client.sendMessage(
          waChatID,
          `Agora este chat está conectado agora com o telegram!`
        );
        ctx.answerCbQuery("Conectado com sucesso!", {
          show_alert: true,
        });
        ctx.editMessageText("Conectado com sucesso!");
      } else {
        ctx.answerCbQuery("Conexão Cancelada!", { show_alert: true });
        await ctx.editMessageText("A Conexão Recusada Com Sucesso!");
      }
      return;
    }
    tgID = ctx.callbackQuery.message.chat.id.toString();
    chatTitle = ctx.callbackQuery.message.chat.title;
    waChatID = queryData;

    ctx.answerCbQuery("Conectado com sucesso!", { show_alert: true });
    try {
      var { conn, coll } = await database("connections");
      await coll.updateOne(
        { tgID: tgID },
        { $set: { whatsAppID: waChatID } },
        { upsert: true }
      );
      await client.sendMessage(
        waChatID,
        `Conectado com Sucesso!`
      );
      cachedData.set(tgID, waChatID);
      cachedData.set(waChatID, tgID);
    } catch (error) {
      console.log(error);
    } finally {
      if (conn) {
        await conn.close();
      }
    }
    ctx.editMessageText("Conectado Com Sucesso!");
  }
});

bot.command("disconnect", async (ctx) => {
  if (["group", "supergroup"].includes(ctx.chat.type)) {
    const chatID = ctx.message.chat.id.toString();
    if (ctx.message.from.id.toString() == config.ownerID.toString()) {
      try {
        var { conn, coll } = await database("connections");
        const data = await coll.findOne({
          tgID: chatID,
        });
        if (data) {
          ctx.reply(`Desconectado!.`);
          await coll.deleteOne({
            tgID: chatID,
          });
          if (cachedData.get(chatID)) {
            cachedData.delete(chatID);
          }
          if (cachedData.get(data.whatsAppID.toString())) {
            cachedData.delete(data.whatsAppID);
          }

          await client.sendMessage(
            data.whatsAppID,
            "Este chat agora está desconectado!"
          );
        } else {
          ctx.reply(`Nenhum Bate-Papo encontrado para Desconectar!.`);
        }
      } catch (error) {
        console.log(error);
      } finally {
        if (conn) {
          await conn.close();
        }
      }
    }
  }
});

bot.start((ctx) =>
  ctx.replyWithMarkdownV2(
    `Hey **${ctx.message.from.first_name}**, Welcome\\!\n\nPowered by [TG\\-WhatsApp](https://github.com/subinps/TG-WhatsApp)\\.`,
    {
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: "Repo", url: "https://github.com/subinps/TG-WhatsApp" }],
        ],
      },
    }
  )
);

bot.on("message", (ctx) => {
  // Liste as mensagens do TG Bot e tome medidas
  handleTgBot(ctx, client, MessageMedia);
});

client.tgbot = bot;

client.initialize();

console.log("Inicializando Clientes.. Por Favor Aguarde...");
