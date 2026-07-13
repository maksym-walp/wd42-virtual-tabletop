// A non-negative integer input that avoids the classic <input type="number">
// leading-zero glitch: typing "5" over a "0" produces "05"/"050" instead of
// replacing it. Shows blank instead of "0" so typing always starts fresh.
export default function IntInput({ value, onChange, min = 0, className = '', ...props }) {
  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    const num = digits === '' ? 0 : parseInt(digits, 10);
    onChange(Math.max(min, num));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value ? String(value) : ''}
      onChange={handleChange}
      onFocus={(e) => e.target.select()}
      className={className}
      {...props}
    />
  );
}
