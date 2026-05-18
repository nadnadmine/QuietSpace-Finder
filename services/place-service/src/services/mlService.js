// services/place-service/src/services/mlService.js
// ─────────────────────────────────────────────────
// HTTP client untuk memanggil Python ml-service.
// Mengimplementasikan circuit breaker sederhana:
// setelah MAX_FAILURES gagal, berhenti mencoba selama COOLDOWN_MS.

const axios = require('axios');

const ML_BASE_URL  = process.env.ML_SERVICE_URL || 'http://ml-service:5001';
const TIMEOUT_MS   = parseInt(process.env.ML_TIMEOUT_MS  || '5000');
const MAX_FAILURES = parseInt(process.env.ML_MAX_FAILURES || '3');
const COOLDOWN_MS  = parseInt(process.env.ML_COOLDOWN_MS  || '30000'); // 30 detik

// ── Circuit Breaker State ─────────────────────────────────────────────────────
const circuit = {
  failures  : 0,
  openSince : null,   // timestamp kapan circuit terbuka
  isOpen() {
    if (!this.openSince) return false;
    if (Date.now() - this.openSince >= COOLDOWN_MS) {
      // Cooldown selesai → half-open, coba lagi
      this.failures  = 0;
      this.openSince = null;
      console.log('[ml-service] Circuit half-open — mencoba koneksi ulang.');
      return false;
    }
    return true;
  },
  recordSuccess() {
    this.failures  = 0;
    this.openSince = null;
  },
  recordFailure() {
    this.failures++;
    if (this.failures >= MAX_FAILURES && !this.openSince) {
      this.openSince = Date.now();
      console.warn(`[ml-service] Circuit OPEN — ${MAX_FAILURES} kegagalan berturut-turut.`);
    }
  },
};

// ── Helper: bangun payload fitur dari object place ────────────────────────────
/**
 * Konversi data place dari database ke format yang dibutuhkan ml-service.
 * @param {Object} place  - data tempat dari place-service DB
 * @param {Array}  tagIds - array tag_id yang dimiliki tempat
 * @returns {Object} payload siap kirim ke /predict
 */
function buildPredictPayload(place, tagIds = []) {
  const now = new Date();

  // Mapping: tag_id → fitur boolean
  // Sesuaikan ID tag dengan data seed di DB QuietSpace
  const WIFI_TAG_IDS    = [1, 2];   // tag "WiFi", "WiFi Gratis"
  const AC_TAG_IDS      = [3];      // tag "AC"
  const PARKING_TAG_IDS = [4, 5];   // tag "Parkir Motor", "Parkir Mobil"

  return {
    place_id  : place.id,
    place_name: place.name,
    features  : {
      category_id      : place.category_id || 2,
      has_wifi         : tagIds.some(id => WIFI_TAG_IDS.includes(id))    ? 1 : 0,
      has_ac           : tagIds.some(id => AC_TAG_IDS.includes(id))      ? 1 : 0,
      has_parking      : tagIds.some(id => PARKING_TAG_IDS.includes(id)) ? 1 : 0,
      avg_report_score : parseFloat(place.avg_report_score) || 3.0,
      total_bookmarks  : parseInt(place.total_bookmarks)    || 0,
      total_reports    : parseInt(place.total_reports)      || 0,
      hour_of_day      : now.getHours(),
      day_of_week      : now.getDay() === 0 ? 6 : now.getDay() - 1, // 0=Senin
      capacity_estimate: place.capacity_estimate || 2,
    },
  };
}

// ── Fungsi utama ──────────────────────────────────────────────────────────────

/**
 * Prediksi quiet score satu tempat.
 * @returns {Object|null} response dari ml-service, atau null jika gagal/circuit open
 */
async function predictOne(place, tagIds = []) {
  if (circuit.isOpen()) {
    console.warn('[ml-service] Circuit OPEN — skip prediction.');
    return null;
  }

  try {
    const payload  = buildPredictPayload(place, tagIds);
    const response = await axios.post(`${ML_BASE_URL}/predict`, payload, {
      timeout: TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });
    circuit.recordSuccess();
    return response.data;
  } catch (err) {
    circuit.recordFailure();
    const reason = err.code === 'ECONNREFUSED'
      ? 'koneksi ditolak'
      : err.code === 'ECONNABORTED'
      ? 'timeout'
      : err.message;
    console.error(`[ml-service] predictOne gagal: ${reason}`);
    return null;
  }
}

/**
 * Prediksi quiet score banyak tempat sekaligus (batch).
 * @param {Array} places   - array data place
 * @param {Object} tagsMap - { place_id: [tag_id, ...] }
 * @returns {Array|null}
 */
async function predictBatch(places, tagsMap = {}) {
  if (circuit.isOpen()) {
    console.warn('[ml-service] Circuit OPEN — skip batch prediction.');
    return null;
  }

  try {
    const payload = {
      places: places.map(p => buildPredictPayload(p, tagsMap[p.id] || [])),
    };
    const response = await axios.post(`${ML_BASE_URL}/batch-predict`, payload, {
      timeout: TIMEOUT_MS * 3,  // batch boleh lebih lama
      headers: { 'Content-Type': 'application/json' },
    });
    circuit.recordSuccess();
    return response.data;
  } catch (err) {
    circuit.recordFailure();
    if (err.response && err.response.data) {
      console.error(`[ml-service] predictBatch gagal: ${err.message}. Detail: ${JSON.stringify(err.response.data)}`);
    } else {
      console.error(`[ml-service] predictBatch gagal: ${err.message}`);
    }
    return null;
  }
}

/**
 * Health check ke ml-service.
 */
async function checkHealth() {
  try {
    const response = await axios.get(`${ML_BASE_URL}/health`, { timeout: 3000 });
    return response.data;
  } catch {
    return { status: 'unavailable' };
  }
}

module.exports = { predictOne, predictBatch, checkHealth, buildPredictPayload };