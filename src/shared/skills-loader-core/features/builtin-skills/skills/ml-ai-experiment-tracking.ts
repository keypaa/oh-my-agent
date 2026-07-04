import type { BuiltinSkill } from "../types"

export const mlAiExperimentTrackingSkill: BuiltinSkill = {
	name: "ml-ai-experiment-tracking",
	description:
		"Log all experiment parameters, metrics, and artifacts to a tracker (W&B, MLflow, TensorBoard). Record dataset versions, model architecture, hyperparameters, and training environment. Maintain experiment lineage. Triggers: experiment tracking, wandb, mlflow, tensorboard, log metrics, track experiments, experiment lineage.",
	template: `# Experiment Tracking

## Purpose
Log all experiment parameters, metrics, and artifacts systematically so every result is reproducible and traceable.

## Workflow

### 1. Initialize Tracker
Before any training run, initialize your tracker:
- **W&B**: \`wandb.init(project="...", name="...", config={...})\`
- **MLflow**: \`mlflow.set_experiment("..."); mlflow.start_run()\`
- **TensorBoard**: \`writer = SummaryWriter("runs/...")\`

### 2. Log Configuration
Record ALL parameters at the start:
- Model architecture (type, layers, dimensions)
- Hyperparameters (learning rate, batch size, optimizer, scheduler)
- Dataset version/hash, split ratios, preprocessing steps
- Training environment (GPU, driver version, library versions, random seed)

### 3. Log Metrics
During training, log at regular intervals:
- Training loss, validation loss
- Task-specific metrics (accuracy, F1, AUC, BLEU, etc.)
- Learning rate schedule, gradient norms
- GPU utilization, memory usage

### 4. Log Artifacts
Save alongside metrics:
- Model checkpoints (best, last, periodic)
- Tokenizer/processor configs
- Training scripts and configs (git commit hash)
- Data preprocessing code

### 5. Tag and Describe
- Use meaningful experiment names: \`lr=1e-4_bs=32_dropout=0.1\`
- Add tags for grouping: \`wandb.tag(["baseline", "v2"])\`
- Write a one-line description of what the experiment tests

## Anti-patterns
- Logging only final metrics (lose training dynamics)
- Not logging failed experiments (miss learning opportunities)
- Hardcoding paths without versioning
- Forgetting to log the random seed
`,
}
