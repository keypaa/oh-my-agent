import { configureMigrationCategoryDefaults } from "#shared/utils/migration/agent-category"

import { DEFAULT_CATEGORIES } from "../tools/delegate-task/constants"

configureMigrationCategoryDefaults(DEFAULT_CATEGORIES)

export * from "#shared/utils/migration"
