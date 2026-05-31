export const Logo = ({ className = '' }: { className?: string }) => (
  <div className={`flex items-center justify-center ${className}`}>
    <img src="/Edugest2.png" alt="Edugest Logo" className="w-full h-full object-contain" />
  </div>
);
