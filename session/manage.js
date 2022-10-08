const fs = require("fs");
const AdmZip = require("adm-zip");
const {
  createEncryptStream,
  setPassword,
  createDecryptStream,
} = require("aes-encrypt-stream");
const crypto = require("crypto");
const config = require("../config");
const axios = require("axios");
require("dotenv").config();

let base = `${__dirname}/../.wwebjs_auth/`;

let excludedDir = [
  "session-whatsbot/Default/Cache",
  "session-whatsbot/Default/Code Cache",
  "session-whatsbot/Default/Code Storage",
  "session-whatsbot/Default/blob_storage",
  "session-whatsbot/Default/Service Worker",
];

module.exports = {
  clean: function clean() {
    try {
      // delete dir if exists
      if (fs.existsSync(`${__dirname}/../.wwebjs_auth`)) {
        fs.rmSync(`${__dirname}/../.wwebjs_auth`, { recursive: true });
        console.log("Diretório De Sessão Foi limpo");
      }
    } catch (_) {}
  },
  write: async function write(password) {
    excludedDir.forEach((dir) => {
      try {
        fs.rmSync(`${base}${dir}/`, { recursive: true });
      } catch (_) {}
    });
    const zip = new AdmZip();
    zip.addLocalFolder(base);
    await zip.writeZipPromise(`${__dirname}/temp.zip`);
    setPassword(getCipherKey(password));
    await new Promise((resolve) => {
      createEncryptStream(fs.createReadStream(`${__dirname}/temp.zip`))
        .pipe(fs.createWriteStream(`${__dirname}/../session.secure`))
        .on("finish", () => {
          resolve();
        });
    });
    fs.unlinkSync(`${__dirname}/temp.zip`);
  },
  replicate: async function replicate() {
    try {
      setPassword(getCipherKey(config.session_key));
      await new Promise((resolve) => {
        fs.createReadStream(`${__dirname}/../session.secure`)
          .pipe(
            createDecryptStream(fs.createWriteStream(`${__dirname}/temp.zip`))
          )
          .on("finish", () => {
            resolve();
          });
      });

      let unzip = new AdmZip(fs.readFileSync(`${__dirname}/temp.zip`));
      unzip.extractAllToAsync(base, true);
      console.log("Arquivos De Sessão Replicados");
    } catch (error) {
      throw new Error(
        `Arquivo de sessão não encontrado, corrompido, a senha não foi encontrada ou ela está errada. ${error.toString()}`
      );
    } finally {
      try {
        fs.unlinkSync(`${__dirname}/temp.zip`);
      } catch (_) {}
    }
  },
  fetchSession: async function fetchSession() {
    try {
      if (process.env.SESSION_URL) {
        let response = await axios.get(process.env.SESSION_URL, {
          responseType: "arraybuffer",
        });
        fs.writeFileSync(`${__dirname}/../session.secure`, response.data, {
          encoding: "binary",
        });
        console.log("Arquivo de Sessão Obtido de", process.env.SESSION_URL);
      } else {
        console.log("Usando Sessão Local");
      }
    } catch (error) {
      throw new Error(
        `Falha na busca da sessão. Se você estiver usando máquina local ou VPS, remova 'SESSION_URL' da Variável de Ambiente. ${error.toString()}`
      );
    }
  },
};

function getCipherKey(password) {
  return crypto.createHash("sha256").update(password).digest();
}
