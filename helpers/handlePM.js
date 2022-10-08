const { database, pmEnabled } = require("../db");
const config = require("../config");

const isEnabled = async (chat) => {
  if (pmEnabled.get(chat) != undefined) {
    return pmEnabled.get(chat);
  } else {
    let status;
    try {
      var { conn, coll } = await database("pmlog");
      const data = await coll.findOne({ chatID: chat.toString() });
      if (data) {
        pmEnabled.set(chat, data.status);
        status = data.status;
      } else {
        pmEnabled.set(chat, "new");
        await coll.insertOne({ chatID: chat.toString(), status: "wait" });
        status = "new";
      }
    } catch (error) {
      console.log(error);
    } finally {
      if (conn) {
        await conn.close();
      }
    }
    return status;
  }
};

const isPMEnabled = async (chatID, name, msg, client) => {
  const status = await isEnabled(chatID);
  if (status == "true") {
    return true;
  }

  if (status == "new") {
    await client.tgbot.telegram.sendMessage(
      config.ownerID,
      `Uma nova mensagem de ${name}, Você deseja registrar mensagens desta pessoa?`,
      {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `Sim, Ativar`,
                callback_data: `pmEnable ${chatID}`,
              },
              {
                text: "Não, não Ativar",
                callback_data: `pmDisable ${chatID}`,
              },
            ],
          ],
        },
      }
    );
  }
  if (config.pmReply.toString() == "true") {
    await msg.reply(
      "Está é uma mensagem automática! \nVocê não deve esperar uma resposta aqui, já que eu fiz para trabalhar apenas em grupos!"
    );
  }

  return false;
};

module.exports = isPMEnabled;
