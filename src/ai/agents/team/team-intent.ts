export const TEAM_FOCUSES = [
  'overview',
  'members',
  'workload',
  'overdue',
  'distribution',
  'completion',
  'deadlines',
  'projects',
  'capacity',
  'assignment',
  'balance',
] as const;

export type TeamFocus = (typeof TEAM_FOCUSES)[number];

export function isTeamQuestion(message: string): boolean {
  const text = message.trim().toLowerCase();
  if (!text) return false;

  if (/\b(?:my team|team overview|team members?|employees?|organization|organisation|workload|task distribution)\b/.test(text)) {
    return true;
  }
  if (/\bwho has\b[\s\S]{0,50}\btasks?\b/.test(text)) return true;
  if (/\bwhich (?:employees?|team members?)\b/.test(text)) return true;
  if (/\b(?:capacity for new tasks|balance the workload|receive this task)\b/.test(text)) return true;
  if (/\b(?:approaching|upcoming)\b[\s\S]{0,40}\b(?:deadlines?|due)\b/.test(text)) return true;
  if (/\bprojects?\b[\s\S]{0,50}\b(?:delayed|progress)\b/.test(text)) return true;
  if (/\bprogress of each project\b/.test(text)) return true;
  return false;
}

export function detectTeamFocus(message: string): TeamFocus {
  const text = message.trim().toLowerCase();
  if (/\bprojects?\b/.test(text) && /\b(?:delayed|progress)\b/.test(text)) return 'projects';
  if (/\bprogress of each project\b/.test(text)) return 'projects';
  if (/\b(?:capacity|who has capacity)\b/.test(text)) return 'capacity';
  if (/\breceive this task\b/.test(text) || /\bshould receive\b/.test(text)) return 'assignment';
  if (/\bbalance the workload\b/.test(text)) return 'balance';
  if (/\b(?:approaching|upcoming)\b/.test(text) && /\b(?:deadlines?|due)\b/.test(text)) return 'deadlines';
  if (/\bcompleted the most\b/.test(text) || /\bmost tasks\b/.test(text) && /\bcompleted\b/.test(text)) return 'completion';
  if (/\boverdue\b/.test(text)) return 'overdue';
  if (/\bdistribution\b/.test(text)) return 'distribution';
  if (/\bmost pending\b/.test(text) || /\bpending tasks\b/.test(text) && /\bwho has\b/.test(text)) return 'workload';
  if (/\bpending work\b/.test(text)) return 'workload';
  if (/\bhow many employees\b/.test(text) || /\blist\b/.test(text) && /\bteam members?\b/.test(text)) return 'members';
  if (/\bworkload\b/.test(text)) return 'workload';
  return 'overview';
}
