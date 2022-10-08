const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { write, clean } = require("./manage");
const readline = require("readline");
const app = require("express")();

clean();

const client = new Client({
  puppeteer: { headless: true, args: ["--no-sandbox"] },
  authStrategy: new LocalAuth({ clientId: "whatsbot" }),
});

let password = null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(
  "Digite a senha para criptografar a sessão (Você precisa colocar isso em ENV - SESSION_KEY): ",
  (answer) => {
    password = answer;
    console.log("Senha definida como:", password);
    console.log("Gerando QR Code...");
    rl.close();
    client.initialize();
  }
);

client.on("qr", (qr) => {
  console.log(`Digitalize este QR Code e copie o JSON\n`);
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  client.destroy();
  console.log("Por favor, Espere...");
  // wait because filesystem is busy
  setTimeout(async () => {
    console.log("A Sessão foi criada com Sucesso");
    await write(password);
    app.listen(8080, () => {
      console.log(
        "Vamos para http://{app_url}/session.secure para baixar a sessão"
      );
    });
  }, 3000);
});

app.get("*", async (req, res) => {
  res.download("./session.secure");
});
