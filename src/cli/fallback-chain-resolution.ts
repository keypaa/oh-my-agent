import type { FallbackEntry } from "../shared/model-requirements"
import type { ProviderAvailability } from "./model-fallback-types"
import { isProviderAvailable } from "./provider-availability"
import { transformModelForProvider } from "./provider-model-id-transform"

export function resolveModelFromChain(
	fallbackChain: FallbackEntry[],
	availability: ProviderAvailability
): { model: string; variant?: string } | null {
	for (const entry of fallbackChain) {
		for (const provider of entry.providers) {
			if (isProviderAvailable(provider, availability)) {
				const transformedModel = transformModelForProvider(provider, entry.model)
				return {
					model: `${provider}/${transformedModel}`,
					variant: entry.variant,
				}
			}
		}
	}
	return null
}

const DEFAULT_SISYPHUS_FALLBACK_CHAIN: FallbackEntry[] = [
	{
		providers: ["anthropic", "github-copilot", "opencode", "vercel"],
		model: "claude-opus-4-7",
		variant: "max",
	},
	{ providers: ["opencode-go", "vercel"], model: "kimi-k2.6" },
	{ providers: ["kimi-for-coding"], model: "k2p5" },
	{
		providers: [
			"opencode",
			"bailian-coding-plan",
			"moonshotai",
			"moonshotai-cn",
			"firmware",
			"ollama-cloud",
			"aihubmix",
			"vercel",
		],
		model: "kimi-k2.5",
	},
	{ providers: ["openai", "github-copilot", "opencode", "vercel"], model: "gpt-5.5", variant: "medium" },
	{ providers: ["zai-coding-plan", "opencode", "bailian-coding-plan", "vercel"], model: "glm-5" },
	{ providers: ["opencode"], model: "big-pickle" },
]

export function getSisyphusFallbackChain(): FallbackEntry[] {
	return DEFAULT_SISYPHUS_FALLBACK_CHAIN
}

export function isAnyFallbackEntryAvailable(
	fallbackChain: FallbackEntry[],
	availability: ProviderAvailability
): boolean {
	return fallbackChain.some((entry) =>
		entry.providers.some((provider) => isProviderAvailable(provider, availability))
	)
}

export function isRequiredModelAvailable(
	requiresModel: string,
	fallbackChain: FallbackEntry[],
	availability: ProviderAvailability
): boolean {
	const matchingEntry = fallbackChain.find((entry) => entry.model === requiresModel)
	if (!matchingEntry) return false
	return matchingEntry.providers.some((provider) => isProviderAvailable(provider, availability))
}

export function isRequiredProviderAvailable(
	requiredProviders: string[],
	availability: ProviderAvailability
): boolean {
	return requiredProviders.some((provider) => isProviderAvailable(provider, availability))
}
