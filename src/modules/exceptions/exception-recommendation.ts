export type Recommendation = {
  suggestion: string;
  suggestionSource: 'rule' | 'model';
};

export async function recommend(
  action: string,
  advisor?: () => Promise<string | null>,
): Promise<Recommendation> {
  if (!advisor) return { suggestion: action, suggestionSource: 'rule' };
  try {
    const text = (await advisor())?.trim();
    if (!text) return { suggestion: action, suggestionSource: 'rule' };
    return { suggestion: text.slice(0, 500), suggestionSource: 'model' };
  } catch {
    return { suggestion: action, suggestionSource: 'rule' };
  }
}
