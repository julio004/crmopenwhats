export const AUTOMATION_TRIGGER_TYPES = ["incoming_message"] as const;
export const AUTOMATION_CONDITION_TYPES = [
	"always",
	"message_contains",
	"conversation_mode",
] as const;
export const AUTOMATION_ACTION_TYPES = [
	"send_whatsapp",
	"switch_mode",
	"add_internal_note",
] as const;

export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];
export type AutomationConditionType = (typeof AUTOMATION_CONDITION_TYPES)[number];
export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export interface AutomationTrigger {
	type: AutomationTriggerType;
}

export interface AutomationCondition {
	type: AutomationConditionType;
	value?: string;
}

export interface AutomationAction {
	type: AutomationActionType;
	value: string;
}

export interface AutomationDefinition {
	trigger: AutomationTrigger;
	conditions: AutomationCondition[];
	actions: AutomationAction[];
}

export interface AutomationRow {
	id: number;
	name: string;
	enabled: boolean;
	trigger_type: AutomationTriggerType;
	definition: AutomationDefinition;
	created_at: Date;
	updated_at: Date;
}

export interface AutomationInput {
	name: string;
	enabled?: boolean;
	definition: AutomationDefinition;
}

function isOneOf<T extends readonly string[]>(
	value: unknown,
	allowed: T,
): value is T[number] {
	return typeof value === "string" && allowed.includes(value);
}

function assertString(value: unknown, field: string): string {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(`invalid_automation_${field}`);
	}
	return value.trim();
}

export function normalizeAutomationInput(input: AutomationInput): AutomationInput {
	const name = assertString(input.name, "name");
	const definition = input.definition;
	if (!definition || typeof definition !== "object") {
		throw new Error("invalid_automation_definition");
	}

	if (!isOneOf(definition.trigger?.type, AUTOMATION_TRIGGER_TYPES)) {
		throw new Error("invalid_automation_trigger");
	}

	const conditions: AutomationCondition[] = Array.isArray(definition.conditions)
		? definition.conditions.map((condition) => {
				if (!isOneOf(condition?.type, AUTOMATION_CONDITION_TYPES)) {
					throw new Error("invalid_automation_condition");
				}
				return {
					type: condition.type,
					value:
						condition.type === "always"
							? undefined
							: assertString(condition.value, "condition_value"),
				};
			})
		: [];

	if (conditions.length === 0) {
		conditions.push({ type: "always" });
	}

	const actions = Array.isArray(definition.actions)
		? definition.actions.map((action) => {
				if (!isOneOf(action?.type, AUTOMATION_ACTION_TYPES)) {
					throw new Error("invalid_automation_action");
				}
				return {
					type: action.type,
					value: assertString(action.value, "action_value"),
				};
			})
		: [];

	if (actions.length === 0) {
		throw new Error("invalid_automation_actions");
	}

	return {
		name,
		enabled: input.enabled === true,
		definition: {
			trigger: { type: definition.trigger.type },
			conditions,
			actions,
		},
	};
}
