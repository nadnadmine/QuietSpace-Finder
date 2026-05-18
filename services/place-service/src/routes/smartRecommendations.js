// services/place-service/src/routes/smartRecommendations.js
// ──────────────────────────────────────────────────────────
// Endpoint GET /api/places/recommendations/smart
// Menggabungkan data tempat dari DB dengan prediksi quiet score dari ml-service.
//
// Tambahkan route ini ke place-service:
//   const smartRec = require('./routes/smartRecommendations');
//   app.use('/api/places', smartRec);

const express = require('express');
const router  = express.Router();
const { predictBatch, checkHealth } = require('../services/mlService');

// Contoh fungsi DB (sesuaikan dengan ORM/query yang dipakai di place-service)
// Di proyek asli, ganti ini dengan query MySQL aktual.
async function getPlacesFromDB(db, filters = {}) {
  const { city, category_id, limit = 20, offset = 0 } = filters;

  let query = `
    SELECT
      p.id,
      p.name,
      p.category_id,
      p.description,
      p.address,
      p.city,
      p.latitude,
      p.longitude,
      p.cover_image_url,
      COALESCE(AVG(r.quiet_score), 3.0)  AS avg_report_score,
      COUNT(DISTINCT b.user_id)          AS total_bookmarks,
      COUNT(DISTINCT r.id)          AS total_reports,
      2                             AS capacity_estimate
    FROM places p
    LEFT JOIN condition_reports   r ON r.place_id = p.id
    LEFT JOIN bookmarks b ON b.place_id = p.id
    WHERE p.deleted_at IS NULL AND p.status = 'approved'
  `;
  const params = [];

  if (city) {
    query += ' AND p.city LIKE ?';
    params.push(`%${city}%`);
  }
  if (category_id) {
    query += ' AND p.category_id = ?';
    params.push(category_id);
  }

  const safeLimit = parseInt(limit, 10) || 20;
  const safeOffset = parseInt(offset, 10) || 0;
  query += ` GROUP BY p.id ORDER BY total_bookmarks DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;

  const [rows] = await db.execute(query, params);
  return rows;
}

async function getTagsByPlaceIds(db, placeIds) {
  if (!placeIds.length) return {};

  const placeholders = placeIds.map(() => '?').join(',');
  const [rows] = await db.execute(
    `SELECT place_id, tag_id FROM place_tags WHERE place_id IN (${placeholders})`,
    placeIds,
  );

  // Bentuk { place_id: [tag_id, ...] }
  return rows.reduce((acc, row) => {
    if (!acc[row.place_id]) acc[row.place_id] = [];
    acc[row.place_id].push(row.tag_id);
    return acc;
  }, {});
}

// ── GET /api/places/recommendations/smart ─────────────────────────────────────
router.get('/recommendations/smart', async (req, res) => {
  const db = req.app.get('db'); // Ambil koneksi DB dari app
  const { city, category_id, limit = 10, offset = 0 } = req.query;

  try {
    // 1. Ambil daftar tempat dari DB
    const places = await getPlacesFromDB(db, { city, category_id, limit: 50, offset });

    if (!places.length) {
      return res.json({
        message : 'Tidak ada tempat ditemukan.',
        data    : { places: [], ml_service_used: false },
        error   : null,
      });
    }

    // 2. Ambil tag masing-masing tempat
    const tagsMap = await getTagsByPlaceIds(db, places.map(p => p.id));

    // 3. Panggil ml-service untuk batch prediksi
    const mlResult = await predictBatch(places, tagsMap);

    let enrichedPlaces;
    let mlServiceUsed = false;

    if (mlResult && mlResult.results) {
      // ml-service berhasil → gabungkan hasil prediksi ke data tempat
      mlServiceUsed = true;
      const predMap = {};
      mlResult.results.forEach(r => {
        if (r.place_id) predMap[r.place_id] = r;
      });

      enrichedPlaces = places.map(place => ({
        ...place,
        quiet_score: predMap[place.id]
          ? {
              label       : predMap[place.id].quiet_label,
              label_text  : predMap[place.id].quiet_label_text,
              confidence  : predMap[place.id].confidence,
              probabilities: predMap[place.id].probabilities,
            }
          : null,
      }));

      // Urutkan: paling tenang di atas
      enrichedPlaces.sort((a, b) => {
        const qa = a.quiet_score?.label ?? -1;
        const qb = b.quiet_score?.label ?? -1;
        return qb - qa;
      });
    } else {
      // ml-service tidak tersedia → fallback: urut by bookmarks
      enrichedPlaces = places.map(place => ({
        ...place,
        quiet_score: null,
      }));
    }

    // Slice sesuai limit yang diminta
    const paginated = enrichedPlaces.slice(0, Number(limit));

    return res.json({
      message : 'Rekomendasi tempat berhasil diambil.',
      data    : {
        places          : paginated,
        total           : paginated.length,
        ml_service_used : mlServiceUsed,
        ml_processing_ms: mlResult?.processing_time_ms ?? null,
        fallback_reason : !mlServiceUsed
          ? 'ml-service tidak tersedia, urutan berdasarkan popularitas.'
          : null,
      },
      error: null,
    });
  } catch (err) {
    console.error('[smartRecommendations] Error:', err.message);
    return res.status(500).json({
      message : 'Gagal mengambil rekomendasi.',
      data    : null,
      error   : { code: 'INTERNAL_ERROR', details: err.message },
    });
  }
});

// ── GET /api/places/:placeId/quiet-score ──────────────────────────────────────
// Prediksi quiet score satu tempat spesifik
router.get('/:placeId/quiet-score', async (req, res) => {
  const db      = req.app.get('db');
  const placeId = parseInt(req.params.placeId);

  if (isNaN(placeId)) {
    return res.status(400).json({ message: 'placeId tidak valid.', data: null, error: null });
  }

  try {
    // Ambil data tempat
    const [[place]] = await db.execute(
      `SELECT p.*, COALESCE(AVG(r.quiet_score), 3.0) AS avg_report_score,
              COUNT(DISTINCT b.user_id) AS total_bookmarks,
              COUNT(DISTINCT r.id) AS total_reports,
              2 AS capacity_estimate
       FROM places p
       LEFT JOIN condition_reports r   ON r.place_id = p.id
       LEFT JOIN bookmarks b ON b.place_id = p.id
       WHERE p.id = ? GROUP BY p.id`,
      [placeId],
    );

    if (!place) {
      return res.status(404).json({ message: 'Tempat tidak ditemukan.', data: null, error: null });
    }

    const tagsMap = await getTagsByPlaceIds(db, [placeId]);
    const { predictOne } = require('../services/mlService');
    const mlResult = await predictOne(place, tagsMap[placeId] || []);

    return res.json({
      message : 'Quiet score berhasil diprediksi.',
      data    : {
        place_id    : place.id,
        place_name  : place.name,
        quiet_score : mlResult
          ? {
              label       : mlResult.quiet_label,
              label_text  : mlResult.quiet_label_text,
              confidence  : mlResult.confidence,
              probabilities: mlResult.probabilities,
            }
          : null,
        ml_available: !!mlResult,
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Gagal memprediksi quiet score.',
      data   : null,
      error  : { code: 'INTERNAL_ERROR', details: err.message },
    });
  }
});

module.exports = router;