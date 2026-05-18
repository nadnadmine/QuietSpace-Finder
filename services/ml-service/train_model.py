"""
train_model.py
--------------
Script training model Quiet Score Classifier untuk QuietSpace Finder.
Jalankan sekali sebelum menjalankan FastAPI service:
    python train_model.py
"""

import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib

# ── Konfigurasi ────────────────────────────────────────────────────────────────
DATASET_PATH_KAGGLE = "dataset/quiet_places_kaggle.csv"
DATASET_PATH_SYNTHETIC = "dataset/quiet_places.csv"

# Deteksi otomatis dataset Kaggle teradaptasi
if os.path.exists(DATASET_PATH_KAGGLE):
    DATASET_PATH = DATASET_PATH_KAGGLE
    DATASET_TYPE = "Kaggle (adapted)"
else:
    DATASET_PATH = DATASET_PATH_SYNTHETIC
    DATASET_TYPE = "Synthetic (default)"

MODEL_PATH   = "model/model.pkl"
SCALER_PATH  = "model/scaler.pkl"
LABEL_MAP    = {0: "Ramai", 1: "Cukup Tenang", 2: "Sangat Tenang"}
FEATURES     = [
    "category_id",
    "has_wifi",
    "has_ac",
    "has_parking",
    "avg_report_score",
    "total_bookmarks",
    "total_reports",
    "hour_of_day",
    "day_of_week",
    "capacity_estimate",
]

# ── Load data ──────────────────────────────────────────────────────────────────
print("=" * 55)
print("  QuietSpace Finder — Training Quiet Score Classifier")
print("=" * 55)

df = pd.read_csv(DATASET_PATH)
print(f"\n[1/6] Dataset loaded  : {len(df)} baris, {len(df.columns)} kolom")
print(f"      Dataset type    : {DATASET_TYPE} ({DATASET_PATH})")
print(f"      Distribusi label : {df['quiet_label'].value_counts().to_dict()}")

X = df[FEATURES].values
y = df["quiet_label"].values

# ── Split ──────────────────────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"\n[2/6] Train/Test split: {len(X_train)} train / {len(X_test)} test")

# ── Preprocessing ──────────────────────────────────────────────────────────────
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)
print(f"\n[3/6] StandardScaler  : fit selesai")

# ── Training ───────────────────────────────────────────────────────────────────
model = RandomForestClassifier(
    n_estimators=150,
    max_depth=10,
    min_samples_split=4,
    random_state=42,
    class_weight="balanced",
)
model.fit(X_train_s, y_train)
print(f"\n[4/6] Model training  : selesai (150 estimators)")

# ── Evaluasi ───────────────────────────────────────────────────────────────────
y_pred = model.predict(X_test_s)
acc    = accuracy_score(y_test, y_pred)

print(f"\n[5/6] Evaluasi model  :")
print(f"      Accuracy : {acc:.4f} ({acc*100:.2f}%)")
print(f"\n      Classification Report:")
print(classification_report(
    y_test, y_pred,
    target_names=[LABEL_MAP[i] for i in sorted(LABEL_MAP)],
))

print("      Confusion Matrix:")
cm = confusion_matrix(y_test, y_pred)
labels = [LABEL_MAP[i] for i in sorted(LABEL_MAP)]
print(f"      {'':>15}", "  ".join(f"{l[:8]:>8}" for l in labels))
for i, row in enumerate(cm):
    print(f"      {labels[i][:15]:>15}", "  ".join(f"{v:>8}" for v in row))

# Feature importance
importances = pd.Series(model.feature_importances_, index=FEATURES)
print(f"\n      Feature Importance (top 5):")
for feat, imp in importances.sort_values(ascending=False).head(5).items():
    print(f"        {feat:<22}: {imp:.4f}")

# ── Simpan model ───────────────────────────────────────────────────────────────
os.makedirs("model", exist_ok=True)
joblib.dump(model,  MODEL_PATH)
joblib.dump(scaler, SCALER_PATH)
print(f"\n[6/6] Model disimpan  : {MODEL_PATH}")
print(f"      Scaler disimpan : {SCALER_PATH}")
print("\n[OK] Training selesai. Jalankan: uvicorn src.main:app --reload --port 5001\n")