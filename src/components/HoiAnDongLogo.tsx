import React, { useState } from 'react';

interface HoiAnDongLogoProps {
  className?: string;
  size?: number | string;
  alt?: string;
}

/**
 * Official Emblem of UBND Phường Hội An Đông
 * Loaded from repository asset logoHAD.png (https://github.com/sonthao021012/PAR_INDEX_HADONG/blob/main/logoHAD.png)
 */
export const HoiAnDongLogo: React.FC<HoiAnDongLogoProps> = ({
  className = 'w-12 h-12',
  size,
  alt = 'Logo UBND Phường Hội An Đông',
}) => {
  const [loadError, setLoadError] = useState(false);
  const style = size ? { width: size, height: size } : undefined;

  // Primary source: local public/logoHAD.png, fallback: raw github
  const imageSrc = loadError
    ? 'https://raw.githubusercontent.com/sonthao021012/PAR_INDEX_HADONG/main/logoHAD.png'
    : '/logoHAD.png';

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={style}
      title={alt}
      role="img"
      aria-label={alt}
    >
      <img
        src={imageSrc}
        alt={alt}
        className="w-full h-full object-contain filter drop-shadow-md hover:scale-105 transition-transform duration-200"
        loading="eager"
        onError={() => {
          if (!loadError) setLoadError(true);
        }}
      />
    </div>
  );
};
