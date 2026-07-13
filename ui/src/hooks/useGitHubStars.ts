import { useState, useCallback } from 'react';

const DISMISS_KEY = 'NUKEMAI_HIDE_GITHUB_STAR';

export const useGitHubStars = (_owner: string, _repo: string) => {
  const [starCount, setStarCount] = useState<number | null>(null);
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // ignore
    }
  }, []);

  const formattedCount = null;

  return { starCount, formattedCount, isDismissed, dismiss };
};
