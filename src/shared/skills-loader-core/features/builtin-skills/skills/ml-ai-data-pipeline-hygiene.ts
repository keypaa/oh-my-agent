import type { BuiltinSkill } from "../types"

export const mlAiDataPipelineHygieneSkill: BuiltinSkill = {
	name: "ml-ai-data-pipeline-hygiene",
	description:
		"Check for train/test data leakage, validate data schema, detect covariate shift, and verify data quality before any training run. Triggers: data leakage, train test split, data validation, covariate shift, data quality, data pipeline, schema validation.",
	template: `# Data Pipeline Hygiene

## Purpose
Catch data issues before they corrupt training: leakage, schema drift, covariate shift, and quality problems.

## Pre-Training Checklist

### 1. Train/Test Leakage Detection
- [ ] No shared IDs between train and test sets
- [ ] No temporal leakage (future data in train, past in test)
- [ ] No augmented samples from test set leaking into train
- [ ] Group splits respect group boundaries (e.g., same user in one split)
- [ ] Verify split was done BEFORE any preprocessing

### 2. Schema Validation
- [ ] Column types match expected schema
- [ ] No unexpected nulls or NaN values
- [ ] Value ranges within expected bounds
- [ ] Categorical values consistent between train and serving
- [ ] Image dimensions, text encoding, feature shapes match model input

### 3. Covariate Shift Detection
- [ ] Compare feature distributions between train and test (KS test, PSI)
- [ ] Check label distribution balance across splits
- [ ] Monitor for distribution drift over time in production data
- [ ] Validate that preprocessing pipeline is identical for all splits

### 4. Data Quality Checks
- [ ] No duplicate rows (exact or near-duplicates)
- [ ] Label noise: spot-check random samples for correctness
- [ ] Missing value patterns: MCAR, MAR, or MNAR?
- [ ] Outlier detection: are extreme values real or errors?
- [ ] Class imbalance: is it intentional or a data collection artifact?

### 5. Reproducibility
- [ ] Data versioning (DVC, S3 versioning, or hash-based)
- [ ] Preprocessing code is version-controlled
- [ ] Split random seed is recorded
- [ ] Full pipeline is rerunnable from raw data

## Validation Code Pattern

\`\`\`python
import pandas as pd
from scipy import stats

def validate_splits(train_df, test_df, id_col, label_col):
    # Check for ID leakage
    train_ids = set(train_df[id_col])
    test_ids = set(test_df[id_col])
    overlap = train_ids & test_ids
    assert len(overlap) == 0, f"ID leakage: {len(overlap)} shared IDs"

    # Check label distribution
    train_labels = train_df[label_col].value_counts(normalize=True)
    test_labels = test_df[label_col].value_counts(normalize=True)
    for label in set(train_labels.index) | set(test_labels.index):
        ratio = train_labels.get(label, 0) / max(test_labels.get(label, 0), 1e-10)
        assert 0.5 < ratio < 2.0, f"Label shift for {label}: ratio={ratio:.2f}"

    # Check feature distributions
    for col in train_df.select_dtypes(include='number').columns:
        if col in test_df.columns:
            ks_stat, p_value = stats.ks_2samp(train_df[col].dropna(), test_df[col].dropna())
            if p_value < 0.01:
                print(f"Warning: Distribution shift in {col} (KS={ks_stat:.3f}, p={p_value:.4f})")
\`\`\`

## Anti-patterns
- Training on data that includes test-time features not available at inference
- Splitting after preprocessing (data leakage through normalization stats)
- Ignoring temporal ordering in time-series data
- Not checking for duplicate samples across splits
`,
}
