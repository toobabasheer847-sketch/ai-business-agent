import { recommend } from './exception-recommendation';

describe('recommend', () => {
  it('uses the deterministic action when no model is configured', async () => {
    await expect(recommend('Review the task.')).resolves.toEqual({
      suggestion: 'Review the task.',
      suggestionSource: 'rule',
    });
  });

  it('falls back to the deterministic action when the model call fails', async () => {
    const advisor = jest.fn(() => {
      throw new Error('provider unavailable');
    });
    await expect(recommend('Review the task.', advisor)).resolves.toEqual({
      suggestion: 'Review the task.',
      suggestionSource: 'rule',
    });
  });

  it('keeps a model suggestion separate from the detected action', async () => {
    await expect(
      recommend('Review the task.', () =>
        Promise.resolve('  Consider calling the owner today.  '),
      ),
    ).resolves.toEqual({
      suggestion: 'Consider calling the owner today.',
      suggestionSource: 'model',
    });
  });
});
