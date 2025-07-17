import * as util from "./client_utils.js";

const socket = io();
const activityForm = document.getElementById("activity-form");
const activityTableBody = document.getElementById("activity-list");
const offersForm = document.getElementById("offers-form");
const offersTableBody = document.getElementById("offers-list");
const timers = {};

activityForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(activityForm);
  const name = formData.get("name");
  const price = parseFloat(formData.get("price"));
  const cycle = parseInt(formData.get("cycle")) * 60;

  await fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price, cycle }),
  })
    .then(res => res.json())
    .then(data => data?.msg ? alert(data.msg) : null);
});

offersForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const formData = new FormData(offersForm);
  const name = formData.get("name");
  const price = parseFloat(formData.get("price"));

  await fetch("/api/offers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "add", name, price }),
  })
    .then(res => res.json())
    .then(data => data?.msg ? alert(data.msg) : null);
});

function startCountdown(id, timeLeft, stopped) {
  const timerElement = document.getElementById(`${id}-timer`);
  const endTime = new Date(Date.now() + timeLeft * 1000);

  if (timers[id]) clearInterval(timers[id]);
  if (stopped) {
    timerElement.innerText = util.formatTime(Math.floor((endTime - Date.now()) / 1000));
    return;
  }  

  timers[id] = setInterval(() => {
    const diff = Math.floor((endTime - Date.now()) / 1000);
    if (diff <= 0) {
      clearInterval(timers[id]);
      timerElement.innerText = "00:00:00";
      delete timers[id];
    } else {
      timerElement.innerText = util.formatTime(diff);
    }
  }, 1000);
}

/**
 * @param {util.Activity[]} activities
 */
function renderActivities(activities) {
  activityTableBody.innerHTML = "";
  for (const act of activities) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${act.name}</td>
      <td>${act.price}</td>
      <td>${Math.floor(act.cycle / 60)} min</td>
      <td id="${act.name}-timer">${util.formatTime(act.time_left)}</td>
      <td>
        <button class="action" title="Przedłuż" data-action="extend">➕</button>
        <button class="action" title="Zastopuj" data-action="pause">⏸️</button>
        <button class="action" title="Skróć" data-action="shorten">➖</button>
        <button class="action" title="Zeruj" data-action="zero">↻</button>
        <button class="action" title="Usuń" data-action="delete">🗑️</button>
      </td>
    `;
    activityTableBody.appendChild(tr);
    [...tr.querySelectorAll("button")].forEach((b) => 
      b.addEventListener("click", async () => {
        await fetch("/api/timer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: act.name,
            action: b.getAttribute("data-action")
          }),
        })
      })
    );
    startCountdown(act.name, act.time_left, act.stopped);
  }
}

/**
 * @param {util.Offer[]} offers
 */
function renderOffers(offers) {
  offersTableBody.innerHTML = "";
  for (const offer of offers) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${offer.name}</td>
      <td>${offer.price}</td>
      <td><button class="action" title="Usuń">🗑️</button></td>
    `;
    offersTableBody.appendChild(tr);
    tr
      .querySelector("button")
      .addEventListener("click", async () => {
        await fetch("/api/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete",
            name: offer.name,
            price: offer.price
          })
        });
      });
  }
}

socket.on("init", (storage) => {
  renderActivities(storage.activities);
  renderOffers(storage.offers);
});
socket.on("update", (storage) => {
  renderActivities(storage.activities);
  renderOffers(storage.offers);
});

