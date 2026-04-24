import { useEffect, useRef } from 'react';

interface Options {
  meta?: boolean;
  ignoreWhenTyping?: boolean;
}

export function useKeyboardShortcut(
  key: string,
  handler: () => void,
  options: Options = {}
): void {
  const { meta = false, ignoreWhenTyping = true } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in input fields
      if (ignoreWhenTyping) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
          return;
        }
      }

      // Check meta key
      if (meta && !e.metaKey && !e.ctrlKey) return;

      // Match key (case-insensitive)
      if (e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault();
        handlerRef.current();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [key, meta, ignoreWhenTyping]);
}
