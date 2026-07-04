import type { BuiltinSkill } from "../types"

export const mlAiEvaluationIntegritySkill: BuiltinSkill = {
	name: "ml-ai-evaluation-integrity",
	description:
		"Use the correct metric for the task, stratified splits, confidence intervals, and avoid test set leakage. Triggers: evaluation metrics, model evaluation, test set, cross validation, stratified split, confidence intervals, metric selection.",
	template: `# Evaluation Integrity

## Purpose
Evaluate models honestly and correctly — right metric, right split, right statistics.

## Metric Selection Guide

| Task Type | Primary Metric | Secondary | When to Use |
|-----------|---------------|-----------|-------------|
| Binary Classification | AUC-ROC | F1, Precision, Recall | Imbalanced classes |
| Multi-class Classification | Macro-F1 | Accuracy, Per-class metrics | Balanced classes |
| Regression | MSE/RMSE | MAE, R² | Continuous targets |
| Object Detection | mAP@0.5 | mAP@0.5:0.95 | COCO-style |
| NLP (Generation) | BLEU/ROUGE | Human eval, BERTScore | Translation, summarization |
| Ranking | NDCG | MAP, MRR | Search, recommendations |
| Anomaly Detection | AUROC | FPR@TPR95 | Rare events |

## Evaluation Best Practices

### 1. Use the Right Split
\`\`\`python
from sklearn.model_selection import StratifiedKFold

# For classification: preserve class distribution
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
for train_idx, val_idx in skf.split(X, y):
    # train on train_idx, evaluate on val_idx
    pass

# For time series: respect temporal ordering
split_idx = int(len(data) * 0.8)
train, test = data[:split_idx], data[split_idx:]
\`\`\`

### 2. Report Confidence Intervals
\`\`\`python
import numpy as np
from scipy import stats

def mean_ci(scores, confidence=0.95):
    n = len(scores)
    mean = np.mean(scores)
    se = stats.sem(scores)
    ci = se * stats.t.ppf((1 + confidence) / 2, n - 1)
    return mean, ci

# Report: "Accuracy: 0.923 +/- 0.015 (95% CI)"
\`\`\`

### 3. Avoid Test Set Leakage
- Never use test set for any decision (HP tuning, early stopping, model selection)
- Test set is for FINAL evaluation only, done ONCE
- If you run test set multiple times, report the variance
- Nested cross-validation for honest estimation with HP tuning

### 4. Stratified Sampling
\`\`\`python
from sklearn.model_selection import train_test_split

# Ensure class balance in splits
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

# Verify
print("Train class distribution:", pd.Series(y_train).value_counts(normalize=True))
print("Test class distribution:", pd.Series(y_test).value_counts(normalize=True))
\`\`\`

### 5. Baseline Comparison
Always compare against:
- A simple baseline (majority class, random, linear model)
- The previous best model (if iterating)
- Human performance (if available)

## Anti-patterns
- Reporting accuracy on imbalanced datasets without F1/AUC
- Not using stratified splits for classification
- Running test set multiple times and reporting the best
- Comparing models on different test sets
- Forgetting to evaluate on edge cases and subgroups
`,
}
