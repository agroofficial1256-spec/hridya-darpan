"""Feature encoding for the Z-Alizadeh Sani extended dataset.

A single `ZASPreprocessor` is fit once per target model and saved alongside it
(joblib), so the exact same encode -> scale steps run at training and at
inference time. Encoding choices:
  - Y/N clinical flags  -> 0/1
  - Sex                 -> Sex_Male (1/0)
  - BBB (3 categories)  -> one-hot (BBB_LBBB, BBB_RBBB), "N" is the baseline
  - VHD (ordinal sevrty)-> 0 (N) .. 3 (Severe)
  - everything else is already numeric and passed through
All encoded columns are then standardized (mean 0, std 1).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "config" / "vessels.json"


def load_config() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


_ENCODING = load_config()["encoding"]
YN_MAP = _ENCODING["yesNoMap"]
SEX_MAP = _ENCODING["sexMap"]
VHD_MAP = _ENCODING["vhdMap"]
BBB_CATEGORIES = _ENCODING["bbbCategories"]  # "N" is the implicit baseline


def load_raw_dataset(csv_path: Path | str | None = None) -> pd.DataFrame:
    csv_path = csv_path or (ROOT / "data" / "z_alizadeh_sani_extended.csv")
    return pd.read_csv(csv_path)


def raw_feature_columns(df: pd.DataFrame, leakage_columns: list[str]) -> list[str]:
    return [c for c in df.columns if c not in leakage_columns]


def encode_features(df: pd.DataFrame, feature_columns: list[str]) -> pd.DataFrame:
    """Turn the raw clinical columns into a fully numeric feature frame."""
    out = pd.DataFrame(index=df.index)
    for col in feature_columns:
        series = df[col]
        if col == "Sex":
            out["Sex_Male"] = series.map(SEX_MAP).astype(float)
        elif col == "BBB":
            for cat in BBB_CATEGORIES:
                out[f"BBB_{cat}"] = (series == cat).astype(float)
        elif col == "VHD":
            out["VHD_severity"] = series.map(VHD_MAP).astype(float)
        elif series.dtype == object or series.dtype.kind in ("O", "U") or str(series.dtype) == "str":
            out[col] = series.map(YN_MAP).astype(float)
        else:
            out[col] = series.astype(float)
    return out


class ZASPreprocessor:
    """Fitted mean/std scaler over the encoded feature frame. Pickle-safe."""

    def __init__(self, feature_columns: list[str]):
        self.feature_columns = feature_columns
        self.encoded_columns_: list[str] | None = None
        self.mean_: np.ndarray | None = None
        self.std_: np.ndarray | None = None

    def fit(self, df: pd.DataFrame) -> "ZASPreprocessor":
        encoded = encode_features(df, self.feature_columns)
        self.encoded_columns_ = list(encoded.columns)
        self.mean_ = encoded.mean(axis=0).to_numpy()
        std = encoded.std(axis=0).replace(0, 1.0).to_numpy()
        self.std_ = std
        return self

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        encoded = encode_features(df, self.feature_columns)
        encoded = encoded.reindex(columns=self.encoded_columns_, fill_value=0.0)
        return (encoded.to_numpy() - self.mean_) / self.std_

    def fit_transform(self, df: pd.DataFrame) -> np.ndarray:
        self.fit(df)
        return self.transform(df)

    def feature_names(self) -> list[str]:
        return self.encoded_columns_
