import type { BuiltinSkill } from "../types"

export const mlAiReproducibleTrainingSkill: BuiltinSkill = {
	name: "ml-ai-reproducible-training",
	description:
		"Set random seeds before every training run, pin dependency versions, and record training environment for full reproducibility. Triggers: reproducible training, random seeds, deterministic training, pin dependencies, training environment, experiment reproducibility.",
	template: `# Reproducible Training

## Purpose
Ensure every training run can be exactly reproduced by controlling all sources of non-determinism.

## Pre-Training: Set ALL Seeds

### Python / NumPy / PyTorch / TensorFlow

\`\`\`python
import os
import random
import numpy as np
import torch

def set_seed(seed: int = 42):
    """Set all random seeds for reproducibility."""
    os.environ["PYTHONHASHSEED"] = str(seed)
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)

    # Deterministic algorithms (may slow training)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
    # PyTorch >= 2.0: torch.use_deterministic_algorithms(True)

    # For DataLoader workers
    def worker_init_fn(worker_id):
        worker_seed = torch.initial_seed() % 2**32
        np.random.seed(worker_seed)
        random.seed(worker_seed)

    return {"generator": torch.Generator().manual_seed(seed),
            "worker_init_fn": worker_init_fn}
\`\`\`

### TensorFlow

\`\`\`python
import tensorflow as tf

def set_tf_seed(seed: int = 42):
    tf.random.set_seed(seed)
    np.random.seed(seed)
    random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
\`\`\`

## Record Training Environment

Save as \`env.json\` alongside your model:

\`\`\`python
import platform, subprocess, sys, torch

env_info = {
    "python": sys.version,
    "platform": platform.platform(),
    "pytorch": torch.__version__,
    "cuda": torch.version.cuda if torch.cuda.is_available() else None,
    "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
    "gpu_count": torch.cuda.device_count(),
    "numpy": np.__version__,
    "pip_freeze": subprocess.check_output([sys.executable, "-m", "pip", "freeze"]).decode(),
}
# Save with experiment
import json
with open("env.json", "w") as f:
    json.dump(env_info, f, indent=2)
\`\`\`

## Pin Dependencies

\`\`\`bash
# Create exact lock file
pip freeze > requirements-lock.txt

# Or use poetry/pdm/uv for proper lockfiles
poetry export -f requirements.txt --output requirements-lock.txt

# Record git state
git rev-parse HEAD > git-commit.txt
git diff HEAD > git-diff.patch
\`\`\`

## Verification

After setting up, verify reproducibility:
1. Run the same script twice with the same seed
2. Compare outputs bit-for-bit (they should match exactly)
3. Document any sources of non-determinism that remain (e.g., cuDNN auto-tuning)

## Anti-patterns
- Only setting \`torch.manual_seed()\` (misses numpy, python, cuda)
- Not setting worker_init_fn for DataLoader
- Using \`cudnn.benchmark = True\` with fixed seeds (overrides determinism)
- Forgetting to record the GPU/driver version
`,
}
