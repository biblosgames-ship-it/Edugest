export const Logo = ({ className = '' }: { className?: string }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <img src="/Edugest2.png" alt="Edugest Logo" className="w-10 h-10 object-contain" />
  </div>
);
