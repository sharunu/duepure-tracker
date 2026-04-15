import { useCallback, useRef } from "react";

export function useLongPress(
  onLongPress: () => void,
  onClick?: () => void,
  options?: { delay?: number }
) {
  const delay = options?.delay ?? 500;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const moved = useRef(false);

  const start = useCallback(() => {
    isLongPress.current = false;
    moved.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (!isLongPress.current && !moved.current && onClick) {
      onClick();
    }
  }, [onClick]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      clear();
      isLongPress.current = true;
      onLongPress();
    },
    [onLongPress, clear]
  );

  const handleTouchMove = useCallback(() => {
    moved.current = true;
    clear();
  }, [clear]);

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: handleTouchMove,
    onContextMenu: handleContextMenu,
    onClick: handleClick,
  };
}
