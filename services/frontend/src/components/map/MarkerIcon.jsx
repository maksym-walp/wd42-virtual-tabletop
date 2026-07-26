import { isIconUrl } from '../../constants/maps';

// Renders a location's marker: an uploaded image when `icon` is a URL, otherwise
// the emoji glyph. Falls back to 📍 when nothing is set.
export default function MarkerIcon({ icon, size = 16 }) {
  const value = icon || '📍';
  if (isIconUrl(value)) {
    return <img src={value} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block' }} />;
  }
  return <span style={{ fontSize: size, lineHeight: 1 }}>{value}</span>;
}
