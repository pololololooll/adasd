import 'dotenv/config';
import * as util from "./utils.js";
import express from "express";
import http from "http";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";

const PORT = 3001;
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
const server = http.createServer(app);
const io = new Server(server);


app.use("/icons", express.static("icons"));

// Normal user resources
util.fileEndpointGet(app, "/", "views/index.html");
util.fileEndpointGet(app, "/style.css", "views/style.css");
util.fileEndpointGet(app, "/script.js", "views/script.js");
util.fileEndpointGet(app, "/sociale", "views/sociale.html");
util.fileEndpointGet(app, "/login", "views/login.html");
util.fileEndpointGet(app, "/client_utils.js", "views/client_utils.js");

// Admin resources 
util.fileEndpointGet(app, "/admin", "views/admin.html", true, "/login");
util.fileEndpointGet(app, "/admin.js", "views/admin.js", true, null);

app.post("/login", (req, res) => {
  if (
    !util.safeCompare(req.body?.nick || "a", process.env.GLOBAL_LOGIN) ||
    !util.safeCompare(req.body?.password || "a", process.env.GLOBAL_PASS)
  ) return res.redirect("/login");

  res.cookie(
    'sID', 
    bcrypt.hashSync(`${process.env.GLOBAL_LOGIN}-|-${process.env.GLOBAL_PASS}`, 4), 
    {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 60 * 1000
    }
  );
  res.redirect("/admin");
});

const storage = util.readStorage();
const COOLDOWN_DURATION = 3000;
/** @type {Object.<string, boolean>} */
const cooldowns = Object.fromEntries(Object.keys(storage.activities).map(k => [k, false]));

app.post("/api/activity", (req, res) => {
  if (!util.isAdmin(req)) return res.sendStatus(403);
  if (!req.body || !req.body.name || !req.body.price || !req.body.cycle)
    return res.send({ msg: "Niepoprawne zapytanie (Czy wszystkie pola są uzupełnione?)" });

  if (storage.activities.map(a => a.name).includes(req.body.name)) {
    const idx = storage.activities.findIndex(a => a.name == req.body.name);
    storage.activities[idx].price = req.body.price;
    storage.activities[idx].cycle = req.body.cycle;
    res.send({ msg: "Pomyślnie zmieniono aktywność" });
  } else {
    storage.activities.push({
      name: req.body.name,
      price: req.body.price,
      cycle: req.body.cycle,
      time_left: 0,
      stopped: false
    });
    cooldowns[req.body.name] = false;
    res.send({ msg: "Pomyślnie dodano aktywność" });
  }
  io.sockets.emit("update", storage);
  util.saveStorage(storage);
});

app.post("/api/offers", (req, res) => {
  if (!util.isAdmin(req)) return res.sendStatus(403);
  if (!req.body || !req.body.action || !req.body.name || !req.body.price)
    return res.send({ msg: "Niepoprawne zapytanie (Czy wszystkie pola są uzupełnione?)" });

  if (storage.offers.map(o => o.name).includes(req.body.name)) {
    const idx = storage.offers.indexOf(o => o.name == req.body.name);
    if (idx === undefined) return;
    if (req.body.action === "delete") {
      storage.offers.splice(idx, 1);
    } else {
      storage.offers[idx].price = req.body.price;
    }
    res.send({ msg: "Pomyślnie zmieniono ofertę" });
  } else {
    storage.offers.push({ name: req.body.name, price: req.body.price });
    res.send({ msg: "Pomyślnie dodano ofertę" });
  }
  io.sockets.emit("update", storage);
  util.saveStorage(storage);
});



app.post("/api/timer", (req, res) => {
  if (!util.isAdmin(req)) return res.sendStatus(403);
  const idx = storage.activities.findIndex(a => a.name == req?.body?.name);
  if (!req.body || !req.body.action || !req.body.name || idx === undefined)
    return res.send({ msg: "Nieprawidłowe zapytanie" });

  const activ = storage.activities[idx];
  if (cooldowns[req.body.name]) return res.send({ msg: "Akcja jest na cooldownie" });
  switch (req.body.action) {
    case "extend":
      storage.activities[idx].time_left += activ.cycle;
      break;
    case "pause":
      storage.activities[idx].stopped = !activ.stopped;
      break;
    case "shorten":
      storage.activities[idx].time_left = Math.max(activ.time_left - activ.cycle, 0);
      break;
    case "zero":
      storage.activities[idx].time_left = 0;
      break;
    case "delete":
      storage.activities.splice(idx, 1);
      break;
    default:
      res.send({ msg: "Nieprawidłowe zapytanie" });
      return;
  }
  cooldowns[req.body.name] = true;
  setTimeout(() => cooldowns[req.body.name] = false, COOLDOWN_DURATION);
  res.send({ msg: "Pomyślnie zmieniono "});
  io.sockets.emit("update", storage);
  util.saveStorage(storage);
});

io.on("connection", (sock) => {
  sock.emit("init", storage);
});

// Decrement every activity's timer each second
setInterval(() => {
  for (let i = 0; i < storage.activities.length; i++) {
    if (storage.activities[i].time_left == 0 || storage.activities[i].stopped) continue;
    storage.activities[i].time_left -= 1;
  }
}, 1000);

// Sync all clients every minute and backup activities
setInterval(() => {
  io.sockets.emit("update", storage);
  util.saveStorage(storage);
}, 60_000);

// Log storage.json to a discord webhook every 10min
setInterval(async () => {
  await util.webhookLog(`Storage.json:\n\`\`\`json\n${JSON.stringify(storage, null, 2)}\n\`\`\``);
}, 600_000);

server.listen(PORT, () => {
  util.log("INFO", `Listening on ::${PORT}`);
});
