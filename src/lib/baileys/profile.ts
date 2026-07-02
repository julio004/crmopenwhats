export function normalizeProfileStatus(value: unknown): string | null {
	if (value == null) return null;

	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	if (Array.isArray(value)) {
		return normalizeProfileStatus(value[0]);
	}

	if (typeof value === "object") {
		const record = value as Record<string, unknown>;
		return (
			normalizeProfileStatus(record.status) ??
			normalizeProfileStatus(record.text) ??
			normalizeProfileStatus(record.message)
		);
	}

	return null;
}
