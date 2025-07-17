/**
 * @typedef Activity
 * @type {object}
 * @property {string} name
 * @property {number} price - w plnach
 * @property {number} cycle - w sekundach 
 * @property {number} time_left - w sekundach
 * @property {boolean} stopped
 */

/**
 * @typedef Offer
 * @type {object}
 * @property {string} name 
 * @property {number} price - w plnach
 */

/**
 * @typedef Storage
 * @type {object}
 * @property {Activity[]} activities
 * @property {Offer[]} offers
 */

/**
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}
