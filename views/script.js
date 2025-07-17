import * as util from "./client_utils.js";

const socket = io();
const activityContainer = document.querySelector(".grid");
const timers = {};

function startCountdown(id, timeLeft, stopped) {
  const timerElement = document.getElementById(`${id}-timer`);
  const endElement = document.getElementById(`${id}-end`);
  const endTime = new Date(Date.now() + timeLeft * 1000);

  endElement.innerText = `Zakończy się o ${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
  if (stopped) {
    timerElement.innerText = util.formatTime(Math.floor((endTime - Date.now()) / 1000));
    endElement.innerText = "Pauza";
    return;
  }  

  timers[id] = setInterval(() => {
    const diff = Math.floor((endTime - Date.now()) / 1000);
    if (diff <= 0) {
      clearInterval(timers[id]);
      timerElement.innerText = "00:00:00";
      endElement.innerText = "Zakończono";
      delete timers[id];
    } else {
      timerElement.innerText = util.formatTime(diff);
    }
  }, 1000);
}

/** @param {util.Activity[]} activities */
function renderActivities(activities) {
  [...document.querySelectorAll(".card")].forEach((el) => el.remove());

  activities.forEach((act) => {
    const cardEl = document.createElement("div");
    cardEl.id = `${act.name}-card`;
    cardEl.classList.add("card");
    cardEl.innerHTML = `
      <h2>${act.name}</h2>
      <div class="timer" id="${act.name}-timer">00:00:00</div>
      <div class="info" id="${act.name}-end">Nie rozpoczęto</div>
    `;
    activityContainer.appendChild(cardEl);

    if (timers[act.name]) clearInterval(timers[act.name]);
    if (act.time_left > 0) {
      startCountdown(act.name, act.time_left, act.stopped);
    } else {
      const timerEl = document.getElementById(`${act.name}-timer`);
      const infoEl = document.getElementById(`${act.name}-end`);
      if (timerEl) timerEl.innerText = "00:00:00";
      if (infoEl) infoEl.innerText = "Zakończono";
    }
  });
}

/**
 * @param {util.Storage} storage
 */
function updatePriceLists(storage) {
  const tbodyActivities = document.getElementById("activities").querySelector("tbody");
  tbodyActivities.innerHTML = "";
  for (const act of storage.activities) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${act.name}</td><td>${act.price} zł</td><td>${act.cycle / 60} min</td>`;
    tbodyActivities.appendChild(tr);
  }

  const tbodyOffers = document.getElementById("offers").querySelector("tbody");
  tbodyOffers.innerHTML = "";
  for (const offer of storage.offers) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${offer.name}</td><td>${offer.price} zł</td>`;
    tbodyOffers.appendChild(tr);
  }
}

socket.on("init", (storage) => {
  renderActivities(storage.activities);
  updatePriceLists(storage);
});

socket.on("update", (storage) => {
  renderActivities(storage.activities);
  updatePriceLists(storage);
});
