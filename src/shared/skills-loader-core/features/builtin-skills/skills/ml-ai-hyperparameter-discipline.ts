import type { BuiltinSkill } from "../types"

export const mlAiHyperparameterDisciplineSkill: BuiltinSkill = {
	name: "ml-ai-hyperparameter-discipline",
	description:
		"Use structured search for hyperparameter selection (grid, random, Bayesian via Optuna/Ray Tune). Record all trials, avoid cherry-picking, use proper validation splits. Triggers: hyperparameter tuning, hyperparameter search, optuna, ray tune, grid search, random search, bayesian optimization, HP tuning.",
	template: `# Hyperparameter Discipline

## Purpose
Find good hyperparameters systematically and honestly — record everything, avoid cherry-picking, use proper validation.

## Search Strategy Selection

| Strategy | When to Use | Budget |
|----------|-------------|--------|
| **Grid Search** | Few HPs (2-3), discrete values | Low (< 50 trials) |
| **Random Search** | Many HPs, any budget | Medium (50-200 trials) |
| **Bayesian (Optuna)** | Expensive training, continuous HPs | High (200+ trials) |
| **Halving/Successive** | Large search space, limited budget | Any |

## Optuna Pattern

\`\`\`python
import optuna

def objective(trial):
    lr = trial.suggest_float("lr", 1e-5, 1e-2, log=True)
    batch_size = trial.suggest_categorical("batch_size", [16, 32, 64, 128])
    dropout = trial.suggest_float("dropout", 0.0, 0.5)
    weight_decay = trial.suggest_float("weight_decay", 1e-6, 1e-2, log=True)

    model = build_model(dropout=dropout)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    train_loader = DataLoader(train_set, batch_size=batch_size)

    val_acc = train_and_evaluate(model, optimizer, train_loader, val_set)
    return val_acc

study = optuna.create_study(direction="maximize")
study.optimize(objective, n_trials=100)

# Log ALL trials, including failures
for trial in study.trials:
    wandb.log({
        "trial_number": trial.number,
        "params": trial.params,
        "value": trial.value,
        "state": trial.state.name,
    })
\`\`\`

## Ray Tune Pattern

\`\`\`python
from ray import tune
from ray.tune.schedulers import ASHAScheduler

search_space = {
    "lr": tune.loguniform(1e-5, 1e-2),
    "batch_size": tune.choice([16, 32, 64, 128]),
    "dropout": tune.uniform(0.0, 0.5),
}

tuner = tune.Tuner(
    train_fn,
    param_space=search_space,
    tune_config=tune.TuneConfig(
        metric="val_acc",
        mode="max",
        num_samples=100,
        scheduler=ASHAScheduler(max_t=100),
    ),
)
results = tuner.fit()
\`\`\`

## Rules

### 1. Split Correctly
- HP tuning uses TRAIN + VALIDATION only
- Final evaluation on TEST set is done ONCE after selecting best HP
- Nested cross-validation for small datasets

### 2. Record Everything
- Log every trial (including failed ones) to W&B/MLflow
- Record search budget, convergence behavior, time per trial
- Save the full study object (\`optuna.save_study(study, "study.json")\`)

### 3. No Cherry-Picking
- Do NOT re-run the best HP with different seeds and report the best result
- Report the mean and std across the search, not the cherry-picked best
- If you re-run for final model, report ALL runs

### 4. Early Stopping
- Use median pruning or Hyperband for expensive trials
- Set minimum budget before pruning kicks in
- Always report how many trials were pruned

## Anti-patterns
- Tuning on test set metrics
- Running many random seeds for the "best" HP and reporting only the best
- Not logging failed trials
- Using too many HPs without enough budget (curse of dimensionality)
- Changing the search space mid-experiment without documenting
`,
}
