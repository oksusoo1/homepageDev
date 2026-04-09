/**
 * 공통 폼 입력 필드 (라벨 + input/textarea)
 */
export default function FormInput({
  label,
  value,
  onChange,
  placeholder = '',
  required = false,
  type = 'text',
  rows,
  disabled = false,
  hint,
  style: customStyle,
}) {
  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    color: '#111827',
    background: disabled ? '#f9fafb' : 'white',
    boxSizing: 'border-box',
    ...customStyle,
  }

  const isTextarea = rows && rows > 1

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: '#6b7280',
          marginBottom: 6,
          letterSpacing: '0.3px',
        }}>
          {label}
        </label>
      )}
      {isTextarea ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={rows}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          style={inputStyle}
        />
      )}
      {hint && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>
          {hint}
        </div>
      )}
    </div>
  )
}
