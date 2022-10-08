const { replicate, clean, fetchSession } = require("./session/manage");
const fs = require("fs");

async function main() {
  try {
    // Mantendo o cache se for um servidor persistente para evitar erros
    if (fs.existsSync(`${__dirname}/.wwebjs_auth`)) {
      console.log("Os Arquivos De Sessão Já Existem");
    } else {
      clean();
      await fetchSession();
      await replicate();
    }
    setTimeout(() => {
      require("./main");
    }, 2000);
  } catch (error) {
    console.error(error?.message);
  }
}
main();
