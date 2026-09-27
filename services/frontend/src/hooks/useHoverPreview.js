import { useCallback, useState } from 'react';

// Прев'ю запису в бічній панелі каталогу: bind(item) дає обробники для
// картки/рядка. Останній наведений запис лишається, коли курсор іде з
// картки, — інакше прев'ю блимало б між картками.
export default function useHoverPreview() {
  const [hovered, setHovered] = useState(null);
  const bind = useCallback((item) => ({
    onMouseEnter: () => setHovered(item),
    onFocus: () => setHovered(item),
  }), []);
  return [hovered, bind, setHovered];
}
