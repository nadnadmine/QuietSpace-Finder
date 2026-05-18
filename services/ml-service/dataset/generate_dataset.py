"""
generate_dataset.py
-------------------
Generates a synthetic dataset for QuietSpace Finder's ML service.

Inspirasi dataset:
- Kaggle: "Urban Noise Levels" (https://www.kaggle.com/datasets/khushikyad001/urban-noise-levels)
  Dataset asli berisi noise_level (dB), location_type, time_of_day, dll.
  Kita adaptasi strukturnya agar sesuai fitur yang tersedia di proyek QuietSpace.

Cara pakai dataset Kaggle asli (opsional):
  1. Buka https://www.kaggle.com/datasets/khushikyad001/urban-noise-levels
  2. Download → urban_noise_levels.csv
  3. Taruh di folder dataset/
  4. Jalankan adapt_kaggle_dataset.py (lihat fungsi adapt_from_kaggle di bawah)

Fitur yang dipakai:
  - category_id        : 1=Perpustakaan, 2=Kafe, 3=Taman, 4=Coworking, 5=Kampus, 6=Masjid
  - has_wifi           : 0/1
  - has_ac             : 0/1
  - has_parking        : 0/1
  - avg_report_score   : 1.0–5.0 (rata-rata skor laporan kondisi)
  - total_bookmarks    : jumlah user yang bookmark
  - total_reports      : jumlah laporan kondisi masuk
  - hour_of_day        : jam akses (0–23)
  - day_of_week        : 0=Senin … 6=Minggu
  - capacity_estimate  : estimasi kapasitas (small=1, medium=2, large=3)

Label:
  - quiet_label : 0=Ramai, 1=Cukup Tenang, 2=Sangat Tenang
"""

import numpy as np
import pandas as pd
import random

random.seed(42)
np.random.seed(42)

# Profil ketenangan per kategori: (mean_quiet_score, std)
# Semakin tinggi → cenderung lebih tenang
CATEGORY_PROFILES = {
    1: ("Perpustakaan", 2.1, 0.5),   # sangat tenang
    2: ("Kafe",         1.1, 0.7),   # ramai–sedang
    3: ("Taman",        1.4, 0.6),   # sedang
    4: ("Coworking",    1.5, 0.5),   # sedang–tenang
    5: ("Kampus",       1.3, 0.6),   # sedang
    6: ("Masjid",       1.9, 0.4),   # tenang
}

def generate_synthetic_dataset(output_path="dataset/quiet_places.csv", num_samples=1200):
    """
    Menghasilkan dataset sintetis default untuk QuietSpace Finder.
    """
    random.seed(42)
    np.random.seed(42)

    rows = []
    for _ in range(num_samples):
        cat_id = random.choice(list(CATEGORY_PROFILES.keys()))
        cat_name, base_quiet, std_quiet = CATEGORY_PROFILES[cat_id]

        has_wifi     = random.choices([0, 1], weights=[0.3, 0.7])[0]
        has_ac       = random.choices([0, 1], weights=[0.4, 0.6])[0]
        has_parking  = random.choices([0, 1], weights=[0.5, 0.5])[0]
        hour         = random.randint(6, 22)
        dow          = random.randint(0, 6)
        capacity     = random.choice([1, 2, 3])           # small, medium, large
        bookmarks    = random.randint(0, 200)
        reports      = random.randint(0, 50)
        report_score = round(random.uniform(2.0, 5.0), 2)

        # Hitung skor ketenangan dasar
        quiet_score = base_quiet + np.random.normal(0, std_quiet)

        # Pengaruh waktu: pagi/malam lebih tenang, siang/sore ramai
        if 7 <= hour <= 9 or 19 <= hour <= 21:
            quiet_score += 0.3
        elif 11 <= hour <= 14:
            quiet_score -= 0.4
        elif hour < 7 or hour > 21:
            quiet_score += 0.5

        # Weekend lebih ramai (kafe/taman), kecuali perpus/masjid
        if dow in [5, 6] and cat_id in [2, 3]:
            quiet_score -= 0.3
        if dow in [5, 6] and cat_id in [1, 6]:
            quiet_score += 0.2

        # Report score tinggi → lebih tenang
        quiet_score += (report_score - 3.0) * 0.2

        # Kapasitas besar → sedikit lebih ramai
        quiet_score -= (capacity - 1) * 0.15

        # AC → lebih nyaman → persepsi tenang meningkat
        quiet_score += has_ac * 0.1

        # Konversi ke label 0, 1, 2
        if quiet_score < 1.0:
            label = 0   # Ramai
        elif quiet_score < 1.8:
            label = 1   # Cukup Tenang
        else:
            label = 2   # Sangat Tenang

        rows.append({
            "category_id":       cat_id,
            "category_name":     cat_name,
            "has_wifi":          has_wifi,
            "has_ac":            has_ac,
            "has_parking":       has_parking,
            "avg_report_score":  report_score,
            "total_bookmarks":   bookmarks,
            "total_reports":     reports,
            "hour_of_day":       hour,
            "day_of_week":       dow,
            "capacity_estimate": capacity,
            "quiet_label":       label,
        })

    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)

    print(f"\n[*] Dataset sintetis berhasil dibuat: {output_path}")
    print(f"    Total baris : {len(df)}")
    print(f"    Distribusi label sintetis:")
    label_map = {0: "Ramai", 1: "Cukup Tenang", 2: "Sangat Tenang"}
    for k, v in df["quiet_label"].value_counts().sort_index().items():
        print(f"      {k} ({label_map[k]}): {v} ({v/len(df)*100:.1f}%)")


# -------------------------------------------------------
# Fungsi opsional: adaptasi dari Kaggle Urban Noise Levels
# -------------------------------------------------------
def adapt_from_kaggle(kaggle_csv_path: str, output_path: str = "dataset/quiet_places_kaggle.csv"):
    """
    Adaptasi dari dataset Kaggle 'Urban Noise Levels'.
    Kolom yang diproses: decibel_level, hour, day_of_week, park_proximity, school_zone, traffic_density.
    Menghasilkan dataset teradaptasi untuk QuietSpace.
    """
    try:
        kdf = pd.read_csv(kaggle_csv_path)
        print(f"\n[*] Mengadaptasi Kaggle dataset dari: {kaggle_csv_path}")
        print("    Kolom terdeteksi:", kdf.columns.tolist())

        # 1. Pemetaan category_id secara probabilitas logis berdasarkan park_proximity dan school_zone
        # category_id: 1=Perpustakaan, 2=Kafe, 3=Taman, 4=Coworking, 5=Kampus, 6=Masjid
        categories = []
        for idx, row in kdf.iterrows():
            if row.get('park_proximity', 0) == 1:
                # 75% chance it is a Park (Taman - 3), 25% others
                cat = random.choices([3, 1, 2, 4, 5, 6], weights=[0.75, 0.05, 0.05, 0.05, 0.05, 0.05])[0]
            elif row.get('school_zone', 0) == 1:
                # 50% Kampus (5), 30% Perpustakaan (1), 20% others
                cat = random.choices([5, 1, 2, 3, 4, 6], weights=[0.50, 0.30, 0.05, 0.05, 0.05, 0.05])[0]
            else:
                # Random Kafe (2), Coworking (4), Masjid (6), Perpustakaan (1)
                cat = random.choices([1, 2, 4, 6], weights=[0.15, 0.40, 0.30, 0.15])[0]
            categories.append(cat)
        kdf["category_id"] = categories

        # 2. Korelasi fitur fasilitas berdasarkan category_id
        wifi = []
        ac = []
        parking = []
        for cat in categories:
            if cat in [1, 4]:  # Perpustakaan, Coworking
                wifi.append(random.choices([0, 1], weights=[0.1, 0.9])[0])
                ac.append(random.choices([0, 1], weights=[0.15, 0.85])[0])
            elif cat in [2, 5]:  # Kafe, Kampus
                wifi.append(random.choices([0, 1], weights=[0.2, 0.8])[0])
                ac.append(random.choices([0, 1], weights=[0.3, 0.7])[0])
            elif cat == 3:  # Taman
                wifi.append(random.choices([0, 1], weights=[0.8, 0.2])[0])
                ac.append(0)  # Outdoor!
            else:  # Masjid
                wifi.append(random.choices([0, 1], weights=[0.8, 0.2])[0])
                ac.append(random.choices([0, 1], weights=[0.5, 0.5])[0])
            
            # Parkir umumnya tersedia (70%)
            parking.append(random.choices([0, 1], weights=[0.3, 0.7])[0])

        kdf["has_wifi"] = wifi
        kdf["has_ac"] = ac
        kdf["has_parking"] = parking

        # 3. Korelasi avg_report_score (1.0–5.0) terbalik dengan decibel_level
        # decibel_level berkisar ~33 sampai ~97
        decibels = kdf["decibel_level"].values
        scores = 5.0 - (decibels - 33) * (4.0 / 64) + np.random.normal(0, 0.3, len(kdf))
        kdf["avg_report_score"] = np.clip(scores, 1.0, 5.0).round(2)

        # 4. total_bookmarks berkorelasi dengan avg_report_score dan wifi
        bookmarks = kdf["avg_report_score"] * 30 + kdf["has_wifi"] * 20 + np.random.randint(0, 40, len(kdf))
        kdf["total_bookmarks"] = bookmarks.astype(int)

        # 5. total_reports berkorelasi dengan traffic_density
        reports = kdf["traffic_density"] * 6 + np.random.randint(0, 12, len(kdf))
        kdf["total_reports"] = reports.astype(int)

        # 6. hour_of_day dari hour
        kdf["hour_of_day"] = kdf["hour"]

        # 7. capacity_estimate (1=Kecil, 2=Sedang, 3=Besar) berdasarkan traffic_density
        capacity = []
        for td in kdf["traffic_density"].values:
            if td <= 2:
                capacity.append(random.choices([1, 2, 3], weights=[0.7, 0.2, 0.1])[0])
            elif td == 3:
                capacity.append(random.choices([1, 2, 3], weights=[0.2, 0.6, 0.2])[0])
            else:
                capacity.append(random.choices([1, 2, 3], weights=[0.1, 0.2, 0.7])[0])
        kdf["capacity_estimate"] = capacity

        # 8. quiet_label berdasarkan decibel_level
        # < 60 dB = 2 (Sangat Tenang), 60–70 dB = 1 (Cukup Tenang), >= 70 dB = 0 (Ramai)
        def decibel_to_label(db):
            if db < 60:
                return 2
            elif db < 70:
                return 1
            return 0
        kdf["quiet_label"] = kdf["decibel_level"].apply(decibel_to_label)

        # Filter kolom akhir sesuai spesifikasi fitur model
        output = kdf[[
            "category_id", "has_wifi", "has_ac", "has_parking",
            "avg_report_score", "total_bookmarks", "total_reports",
            "hour_of_day", "day_of_week", "capacity_estimate", "quiet_label"
        ]]
        
        # Simpan ke target path
        output.to_csv(output_path, index=False)
        print(f"[*] Berhasil diadaptasi: {len(output)} baris -> {output_path}")
        print(f"    Distribusi label Kaggle adapted:")
        label_map = {0: "Ramai", 1: "Cukup Tenang", 2: "Sangat Tenang"}
        for k, v in output["quiet_label"].value_counts().sort_index().items():
            print(f"      {k} ({label_map[k]}): {v} ({v/len(output)*100:.1f}%)")

    except Exception as e:
        print(f"[-] Gagal adaptasi: {e}")


if __name__ == "__main__":
    import os
    
    # Pastikan direktori dataset ada
    os.makedirs("dataset", exist_ok=True)
    
    print("=" * 60)
    print("  QuietSpace Finder - Dataset Generator & Kaggle Adaptor")
    print("=" * 60)
    
    # 1. Jalankan pembuatan dataset sintetis (1200 baris)
    generate_synthetic_dataset("dataset/quiet_places.csv", num_samples=1200)
    
    # 2. Cek apakah dataset Kaggle asli tersedia
    kaggle_source = "dataset/urban_noise_levels.csv"
    if os.path.exists(kaggle_source):
        adapt_from_kaggle(kaggle_source, "dataset/quiet_places_kaggle.csv")
    else:
        print(f"\n[!] Dataset Kaggle asli tidak ditemukan di: {kaggle_source}")
        print("    Hanya menggunakan dataset sintetis default.")
    
    print("\n[OK] Pemrosesan dataset selesai.")