// https://github.com/tuhinpal/WhatsBot/blob/main/db/index.js

const { MongoClient } = require("mongodb");
const { mongodb_url } = require("../config");

var cachedData = new Map(); // mappings of tg <-> whatsapp chatIDS // mapeamentos do TG <-> IDs de bate-papo do whatsapp
var replyIDSTG = new Map(); // mapping to store tgMessageID -> whatsApp msgID // mapeamento para armazenar tgMessageID -> ID da mensagem do WhatsApp
var replyIDSWhatsAPP = new Map(); // mapping to store whatsApp msgID -> tgMessageID // mapeamento para armazenar msgID do WhatsApp -> tgMessageID
var pmEnabled = new Map(); // mapping for PM log status // mapeamento para status de log de PM ( privado do bot )

const database = async (collection) => {
  var conn = await MongoClient.connect(mongodb_url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  return {
    conn,
    coll: conn.db("whatsbot").collection(collection),
  };
};

module.exports = {
  database,
  cachedData,
  replyIDSTG,
  replyIDSWhatsAPP,
  pmEnabled,
};
