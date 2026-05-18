"""
src/main.py
-----------
FastAPI ML Service untuk QuietSpace Finder.
Menyediakan prediksi Quiet Score sebuah tempat menggunakan
model RandomForestClassifier yang sudah dilatih.

Jalankan:
    uvicorn src.main:app --host 0.0.0.0 --port 5001 --reload

Swagger UI otomatis tersedia di: http://localhost:5001/docs
"""

import os
import time
from contextlib import asynccontextmanager
from typing import List, Optional

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

# ── Path ───────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH  = os.path.join(BASE_DIR, "model", "model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "model", "scaler.pkl")

FEATURES = [
    "category_id", "has_wifi", "has_ac", "has_parking",
    "avg_report_score", "total_bookmarks", "total_reports",
    "hour_of_day", "day_of_week", "capacity_estimate",
]

LABEL_MAP = {
    0: "Ramai",
    1: "Cukup Tenang",
    2: "Sangat Tenang",
}

CATEGORY_MAP = {
    1: "Perpustakaan",
    2: "Kafe",
    3: "Taman",
    4: "Coworking Space",
    5: "Kampus",
    6: "Masjid / Tempat Ibadah",
}

# ── State (model di-load sekali saat startup) ──────────────────────────────────
ml_state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        ml_state["model"]  = joblib.load(MODEL_PATH)
        ml_state["scaler"] = joblib.load(SCALER_PATH)
        ml_state["ready"]  = True
        print("[ml-service] [OK] Model dan scaler berhasil dimuat.")
    except FileNotFoundError as e:
        ml_state["ready"] = False
        print(f"[ml-service] [FAIL] Gagal load model: {e}")
        print("[ml-service]   Jalankan: python train_model.py")
    yield
    # Shutdown
    ml_state.clear()


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="QuietSpace ML Service",
    description=(
        "AI/ML Inference Service untuk QuietSpace Finder.\n\n"
        "Service ini memprediksi **Quiet Score** sebuah tempat berdasarkan "
        "fitur-fiturnya (kategori, fasilitas, waktu, laporan kondisi, dll).\n\n"
        "Dibuat untuk Pertemuan 11 — Intelligent Service."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schema ─────────────────────────────────────────────────────────────────────
class PlaceFeatures(BaseModel):
    category_id: int = Field(
        ..., ge=1, le=6,
        description="1=Perpustakaan, 2=Kafe, 3=Taman, 4=Coworking, 5=Kampus, 6=Masjid",
        json_schema_extra={"example": 1},
    )
    has_wifi: int = Field(
        ..., ge=0, le=1,
        description="1 = ada WiFi, 0 = tidak ada",
        json_schema_extra={"example": 1},
    )
    has_ac: int = Field(
        ..., ge=0, le=1,
        description="1 = ada AC, 0 = tidak ada",
        json_schema_extra={"example": 1},
    )
    has_parking: int = Field(
        ..., ge=0, le=1,
        description="1 = ada parkir, 0 = tidak ada",
        json_schema_extra={"example": 0},
    )
    avg_report_score: float = Field(
        ..., ge=1.0, le=5.0,
        description="Rata-rata skor laporan kondisi (1.0–5.0)",
        json_schema_extra={"example": 4.5},
    )
    total_bookmarks: int = Field(
        ..., ge=0,
        description="Jumlah user yang mem-bookmark tempat ini",
        json_schema_extra={"example": 87},
    )
    total_reports: int = Field(
        ..., ge=0,
        description="Jumlah laporan kondisi yang masuk",
        json_schema_extra={"example": 12},
    )
    hour_of_day: int = Field(
        ..., ge=0, le=23,
        description="Jam saat ini (0–23)",
        json_schema_extra={"example": 10},
    )
    day_of_week: int = Field(
        ..., ge=0, le=6,
        description="Hari dalam seminggu: 0=Senin … 6=Minggu",
        json_schema_extra={"example": 2},
    )
    capacity_estimate: int = Field(
        ..., ge=1, le=3,
        description="Estimasi kapasitas: 1=Kecil, 2=Sedang, 3=Besar",
        json_schema_extra={"example": 2},
    )


class PredictRequest(BaseModel):
    place_id: Optional[str]    = Field(None, description="ID tempat dari place-service")
    place_name: Optional[str]  = Field(None, description="Nama tempat (opsional, untuk label response)")
    features: PlaceFeatures

    model_config = {
        "json_schema_extra": {
            "example": {
                "place_id": 42,
                "place_name": "Perpustakaan Kota Bandung",
                "features": {
                    "category_id": 1,
                    "has_wifi": 1,
                    "has_ac": 1,
                    "has_parking": 0,
                    "avg_report_score": 4.5,
                    "total_bookmarks": 87,
                    "total_reports": 12,
                    "hour_of_day": 10,
                    "day_of_week": 2,
                    "capacity_estimate": 2,
                },
            }
        }
    }


class PredictResponse(BaseModel):
    place_id: Optional[str]
    place_name: Optional[str]
    category_name: str
    quiet_label: int
    quiet_label_text: str
    confidence: float
    probabilities: dict
    service: str = "python-ml-fastapi"
    version: str = "1.0.0"


class BatchPredictRequest(BaseModel):
    places: List[PredictRequest] = Field(..., min_length=1, max_length=50)


class BatchPredictResponse(BaseModel):
    total: int
    results: List[PredictResponse]
    processing_time_ms: float
    service: str = "python-ml-fastapi"


# ── Helper ─────────────────────────────────────────────────────────────────────
def _predict_one(req: PredictRequest) -> PredictResponse:
    if not ml_state.get("ready"):
        raise HTTPException(status_code=503, detail="Model belum siap. Jalankan train_model.py terlebih dahulu.")

    f = req.features
    X_raw = np.array([[
        f.category_id, f.has_wifi, f.has_ac, f.has_parking,
        f.avg_report_score, f.total_bookmarks, f.total_reports,
        f.hour_of_day, f.day_of_week, f.capacity_estimate,
    ]])

    X_scaled = ml_state["scaler"].transform(X_raw)
    pred      = int(ml_state["model"].predict(X_scaled)[0])
    proba     = ml_state["model"].predict_proba(X_scaled)[0]

    return PredictResponse(
        place_id        = req.place_id,
        place_name      = req.place_name,
        category_name   = CATEGORY_MAP.get(f.category_id, "Tidak dikenal"),
        quiet_label     = pred,
        quiet_label_text= LABEL_MAP[pred],
        confidence      = round(float(proba.max()), 4),
        probabilities   = {
            LABEL_MAP[i]: round(float(p), 4)
            for i, p in enumerate(proba)
        },
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.get(
    "/health",
    summary="Health Check",
    tags=["Utility"],
)
async def health_check():
    return {
        "status"        : "ok" if ml_state.get("ready") else "degraded",
        "model_loaded"  : ml_state.get("ready", False),
        "service"       : "python-ml-fastapi",
        "version"       : "1.0.0",
        "endpoints"     : ["/health", "/predict", "/batch-predict", "/model-info"],
    }


@app.get(
    "/model-info",
    summary="Informasi Model yang Aktif",
    tags=["Utility"],
)
async def model_info():
    if not ml_state.get("ready"):
        raise HTTPException(status_code=503, detail="Model belum dimuat.")
    model = ml_state["model"]
    return {
        "algorithm"      : type(model).__name__,
        "n_estimators"   : model.n_estimators,
        "n_features"     : model.n_features_in_,
        "features"       : FEATURES,
        "classes"        : [LABEL_MAP[c] for c in model.classes_],
        "label_map"      : LABEL_MAP,
        "category_map"   : CATEGORY_MAP,
        "dataset"        : "quiet_places.csv (1200 baris, synthetic)",
    }


@app.post(
    "/predict",
    response_model=PredictResponse,
    summary="Prediksi Quiet Score Satu Tempat",
    tags=["Prediction"],
)
async def predict(req: PredictRequest):
    """
    Prediksi tingkat ketenangan sebuah tempat berdasarkan fitur-fiturnya.

    **Label hasil:**
    - `0` = Ramai
    - `1` = Cukup Tenang
    - `2` = Sangat Tenang
    """
    try:
        return _predict_one(req)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@app.post(
    "/batch-predict",
    response_model=BatchPredictResponse,
    summary="Prediksi Quiet Score Banyak Tempat Sekaligus (Bonus)",
    tags=["Prediction"],
)
async def batch_predict(req: BatchPredictRequest):
    """
    Prediksi untuk banyak tempat sekaligus (maks 50 tempat per request).
    Hasil diurutkan berdasarkan `quiet_label` tertinggi (paling tenang duluan).
    """
    t0 = time.time()
    results = []
    for place_req in req.places:
        try:
            results.append(_predict_one(place_req))
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error on place_id={place_req.place_id}: {str(e)}"
            )

    # Urutkan: paling tenang di atas
    results.sort(key=lambda r: r.quiet_label, reverse=True)

    return BatchPredictResponse(
        total               = len(results),
        results             = results,
        processing_time_ms  = round((time.time() - t0) * 1000, 2),
    )