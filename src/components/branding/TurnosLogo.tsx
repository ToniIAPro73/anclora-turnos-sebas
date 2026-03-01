export const TurnosLogo = () => {
  return (
    <div
      aria-hidden="true"
      style={{
        width: '54px',
        height: '54px',
        borderRadius: '16px',
        background: 'linear-gradient(145deg, rgba(175, 210, 250, 0.18), rgba(212, 175, 55, 0.18))',
        border: '1px solid rgba(255,255,255,0.16)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(12px)',
      }}
    >
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="7" width="26" height="22" rx="6" fill="url(#panel)" />
        <path d="M10 4V10" stroke="#D4AF37" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M24 4V10" stroke="#D4AF37" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M4 13H30" stroke="rgba(245,245,240,0.22)" strokeWidth="1.6" />
        <circle cx="11.5" cy="18" r="2.1" fill="#AFD2FA" />
        <circle cx="17" cy="18" r="2.1" fill="#7FB8F5" />
        <circle cx="22.5" cy="18" r="2.1" fill="#D4AF37" />
        <path
          d="M12 25L17 14L22 25"
          stroke="#F5F5F0"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14.4 21.2H19.6"
          stroke="#F5F5F0"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="panel" x1="4" y1="7" x2="30" y2="29" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E2C67" />
            <stop offset="1" stopColor="#121B3C" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
