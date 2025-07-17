import 'dotenv/config';
import express from "express";
import http from "http";
import fs from "fs";
import bcrypt from "bcrypt";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { join, dirname } from 'path';
import { fileURLToPath } from "url";

const root = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (_, res) => {
  res.sendFile("views/index.html", { root: root });
});

app.get("/style.css", (_, res) => {
  res.sendFile("views/style.css", { root: root });
});

app.get("/script.js", (_, res) => {
  res.sendFile("views/script.js", { root: root });
});

app.get("/login", (_, res) => {
  res.sendFile("views/login.html", { root: root });
});

function safeCompare(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length != bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

app.post("/login", (req, res) => {
  if (
    safeCompare(req.body?.nick || "a", process.env.GLOBAL_LOGIN) &&
    safeCompare(req.body?.password || "a", process.env.GLOBAL_PASS)
  ) {
    res.cookie(
      'sID', 
      bcrypt.hashSync(`${process.env.GLOBAL_LOGIN}-|-${process.env.GLOBAL_PASS}`, 4), 
      {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 60 * 1000
      }
    );
    res.redirect("/admin");
  } else {
    res.redirect("/login");
  }
});

function isAdmin(req) {
  const sID = req.cookies.sID;
  if (
    sID != null &&
    bcrypt.compareSync(`${process.env.GLOBAL_LOGIN}-|-${process.env.GLOBAL_PASS}`, sID)
  ) {
    return true;
  } else {
    return false;
  }
}

app.get("/admin", (req, res) => {
  if (isAdmin(req)) {
    res.sendFile("views/admin.html", { root: root });
  } else {
    res.redirect("/login");
  }
});

app.get("/admin.js", (req, res) => {
  if (isAdmin(req)) {
    res.sendFile("views/admin.js", { root: root });
  } else {
    res.redirect("/login");
  }
});

/**
 * @typedef Activity
 * @type {object}
 * @property {string} name
 * @property {number} price - w plnach
 * @property {number} cycle - w sekundach 
 * @property {number} time_left - w sekundach
 * @property {boolean} stopped
 */

/** @type{Activity[]} */
let activitiesJSON = null;
fs.readFile(join(root, "czynnosci.json"), "utf-8", (err, data) => {
  if (err) console.error(err);
  activitiesJSON = JSON.parse(data);
});

function saveActivities() {
  fs.writeFile(join(root, "czynnosci.json"), JSON.stringify(activitiesJSON), err => {
    if (err) console.error(err);
  });
}

app.post("/api/activity", (req, res) => {
  if (isAdmin(req)) {
    if (!req.body || !req.body.name || !req.body.price || !req.body.cycle) {
      res.send({ msg: "Niepoprawne zapytanie (Czy wszystkie pola są uzupełnione?)" });
      return;
    }

    if (activitiesJSON.map(a => a.name).includes(req.body.name)) {
      const idx = activitiesJSON.findIndex(a => a.name == req.body.name);
      activitiesJSON[idx].price = req.body.price;
      activitiesJSON[idx].cycle = req.body.cycle;
      res.send({ msg: "Pomyślnie zmieniono aktywność" });
    } else {
      activitiesJSON.push({
        name: req.body.name,
        price: req.body.price,
        cycle: req.body.cycle,
        time_left: 0,
        stopped: false
      });
      res.send({ msg: "Pomyślnie dodano aktywność" });
    }
    io.sockets.emit("timerUpdate", activitiesJSON);
    saveActivities();
  } else {
    res.redirect("/");
  }
});

app.post("/api/timer", (req, res) => {
  if (isAdmin(req)) {
    const idx = activitiesJSON.findIndex(a => a.name == req?.body?.name);
    if (!req.body || !req.body.action || !req.body.name || idx === undefined) {
      res.send({ msg: "Nieprawidłowe zapytanie" });
      return;
    }
    const activ = activitiesJSON[idx];
    switch (req.body.action) {
      case "extend":
        activitiesJSON[idx].time_left += activ.cycle;
        break;
      case "pause":
        activitiesJSON[idx].stopped = !activ.stopped;
        break;
      case "shorten":
        activitiesJSON[idx].time_left = Math.max(activ.time_left - activ.cycle, 0);
        break;
      case "zero":
        activitiesJSON[idx].time_left = 0;
        break;
      case "delete":
        activitiesJSON.splice(idx, 1);
        break;
      default:
        res.send({ msg: "Nieprawidłowe zapytanie" });
        return;
    }
    res.send({ msg: "Pomyślnie zmieniono "});
    io.sockets.emit("timerUpdate", activitiesJSON);
    saveActivities();
  } else {
    res.redirect("/");
  }
});

io.on("connection", (sock) => {
  sock.emit("init", activitiesJSON);
});

setInterval(() => {
  for (let i = 0; i < activitiesJSON.length; i++) {
    if (activitiesJSON[i].time_left == 0 || activitiesJSON[i].stopped) continue;
    activitiesJSON[i].time_left -= 1;
  }
}, 1000);

setInterval(() => {
  io.sockets.emit("timerUpdate", activitiesJSON);
  saveActivities();
}, 60_000);

const port = 3001;
server.listen(port, () => {
  console.log(`Nasłuchuje na portcie ${port}`);
});
