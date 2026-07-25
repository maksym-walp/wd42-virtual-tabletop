import { useMarkerTypes } from '../../context/MarkerTypesContext';

// Renders a location type's icon (config image if set, otherwise its emoji).
export default function TypeIcon({ typeKey, size = 16 }) {
  const mt = useMarkerTypes();
  const meta = mt.metaFor(typeKey);
  const url = mt.iconUrl(meta);
  if (url) {
    return <img src={url} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block' }} />;
  }
  return <span style={{ fontSize: size, lineHeight: 1 }}>{meta.emoji || '📍'}</span>;
}
