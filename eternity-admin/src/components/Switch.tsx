export default function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={onChange} disabled={disabled} />
  );
}
