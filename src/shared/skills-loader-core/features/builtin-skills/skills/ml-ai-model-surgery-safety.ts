import type { BuiltinSkill } from "../types"

export const mlAiModelSurgerySafetySkill: BuiltinSkill = {
	name: "ml-ai-model-surgery-safety",
	description:
		"Validate output distribution before and after fine-tuning, quantizing, or pruning. Run comparison evaluations and check for degradation on subgroups. Triggers: model surgery, fine-tuning, quantization, pruning, model optimization, distillation, model compression, conversion validation.",
	template: `# Model Surgery Safety

## Purpose
Perform model modifications (fine-tuning, quantization, pruning, distillation) safely with before/after validation.

## Pre-Surgery Checklist

### 1. Baseline Evaluation
Before any modification, establish a complete baseline:
\`\`\`python
def evaluate_model(model, test_loader, name="baseline"):
    """Full evaluation before surgery."""
    metrics = {}
    all_preds = []
    all_labels = []

    model.eval()
    with torch.no_grad():
        for batch in test_loader:
            outputs = model(batch["input"])
            preds = outputs.argmax(dim=-1)
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(batch["label"].cpu().numpy())

    # Overall metrics
    metrics["accuracy"] = accuracy_score(all_labels, all_preds)
    metrics["f1_macro"] = f1_score(all_labels, all_preds, average="macro")

    # Subgroup metrics (detect degradation)
    for subgroup in get_subgroups(test_loader.dataset):
        mask = subgroup["mask"]
        subgroup_acc = accuracy_score(
            np.array(all_labels)[mask], np.array(all_preds)[mask]
        )
        metrics[f"subgroup_{subgroup['name']}_acc"] = subgroup_acc

    # Inference stats
    metrics["model_size_mb"] = get_model_size_mb(model)
    metrics["inference_time_ms"] = measure_inference_latency(model, test_loader)

    log_to_tracker(metrics, name=name)
    return metrics
\`\`\`

### 2. During Surgery
- Save intermediate checkpoints
- Log training dynamics (loss curve, gradient norms)
- Monitor for catastrophic forgetting (performance collapse on original tasks)

### 3. Post-Surgery Validation
\`\`\`python
def validate_surgery(baseline_metrics, post_metrics, tolerance=0.02):
    """Validate that surgery didn't break anything."""
    issues = []

    # Overall metric degradation
    for key in ["accuracy", "f1_macro"]:
        drop = baseline_metrics[key] - post_metrics[key]
        if drop > tolerance:
            issues.append(f"DEGRADATION: {key} dropped by {drop:.4f}")

    # Subgroup fairness
    baseline_subgroups = {k: v for k, v in baseline_metrics.items() if k.startswith("subgroup_")}
    post_subgroups = {k: v for k, v in post_metrics.items() if k.startswith("subgroup_")}
    for key in baseline_subgroups:
        if key in post_subgroups:
            drop = baseline_subgroups[key] - post_subgroups[key]
            if drop > tolerance * 2:  # Subgroups have wider tolerance
                issues.append(f"SUBGROUP DEGRADATION: {key} dropped by {drop:.4f}")

    # Performance requirements
    if post_metrics["inference_time_ms"] > baseline_metrics["inference_time_ms"] * 1.5:
        issues.append("INFERENCE REGRESSION: >50% slower than baseline")

    return issues
\`\`\`

## Surgery-Specific Checks

### Quantization
- [ ] Compare output logits before vs after (should be close)
- [ ] Check for NaN/Inf outputs
- [ ] Verify numerical precision on edge cases (very small/large inputs)

### Pruning
- [ ] Verify sparsity ratio matches target
- [ ] Check that pruned layers still produce valid outputs
- [ ] Fine-tune after pruning and re-evaluate

### Fine-tuning
- [ ] Monitor for catastrophic forgetting on original tasks
- [ ] Check that new task performance improves
- [ ] Validate on original task's test set too

### Distillation
- [ ] Compare teacher vs student outputs on held-out set
- [ ] Check student calibration (probability distribution shape)
- [ ] Verify student handles edge cases the teacher handled

## Anti-patterns
- Not evaluating before surgery (no baseline)
- Only checking overall metrics (miss subgroup degradation)
- Skipping numerical stability checks after quantization
- Not monitoring for catastrophic forgetting during fine-tuning
`,
}
