export const ANALYTICS_ACTIONS = [
  'analytics.overview',
  'analytics.sales',
  'analytics.proposals',
  'analytics.tasks',
] as const;

export type AnalyticsAction = (typeof ANALYTICS_ACTIONS)[number];

export function isAnalyticsQuestion(message: string): boolean {
  const text = message.trim().toLowerCase();
  if (!text) return false;
  if (/\b(?:business performing|compare this month|compare last month|last month|lead conversion|proposal acceptance|proposals were accepted|accepted in the last)\b/.test(text)) {
    return true;
  }
  if (/\boverdue tasks?\b[\s\S]{0,30}\bincreas/.test(text) || /\bwhy are overdue\b/.test(text)) return true;
  if (/\bsummary of sales\b/.test(text)) return true;
  if (/\bsales pipeline\b/.test(text) && /\b(?:proposal|acceptance|team)\b/.test(text)) return true;
  if (/\banalytics\b/.test(text)) return true;
  return false;
}

export function analyticsActions(message: string): AnalyticsAction[] {
  const text = message.trim().toLowerCase();
  const actions: AnalyticsAction[] = [];
  const push = (action: AnalyticsAction) => {
    if (!actions.includes(action)) actions.push(action);
  };
  const combined = /\bsummary of sales\b/.test(text) || (/\bsales pipeline\b/.test(text) && /\b(?:proposal|team)\b/.test(text));
  if (combined) {
    push('analytics.sales');
    push('analytics.proposals');
    push('analytics.tasks');
    return actions;
  }
  if (/\b(?:proposal acceptance|proposals were accepted|accepted in the last)\b/.test(text)) push('analytics.proposals');
  if (/\blead conversion\b|\bsales pipeline\b/.test(text)) push('analytics.sales');
  if (/\boverdue\b|\bteam task\b|\btask completion\b/.test(text)) push('analytics.tasks');
  if (!actions.length) push('analytics.overview');
  return actions;
}
