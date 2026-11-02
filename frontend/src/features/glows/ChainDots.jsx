const ChainDots = ({ length, color }) => {
  const shown = Math.min(length, 5);
  return (
    <span className="flex items-center" aria-hidden>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && <span className="h-px w-2" style={{ background: color }} />}
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: i === shown - 1 ? color : "transparent", border: `1.5px solid ${color}` }}
          />
        </span>
      ))}
    </span>
  );
};

export default ChainDots;
