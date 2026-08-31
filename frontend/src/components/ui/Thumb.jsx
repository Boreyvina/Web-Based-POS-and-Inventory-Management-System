import { imageSrc } from '../../utils/image';

const SIZES = {
  sm: 'h-11 w-11 rounded-lg',
  md: 'h-16 w-16 rounded-lg',
  lg: 'aspect-square w-full rounded-t-xl',
};

/** Product thumbnail with a neutral placeholder when there is no photo. */
export default function Thumb({ src, alt = '', size = 'sm', className = '' }) {
  const box = `${SIZES[size]} shrink-0 bg-slate-100 object-cover ${className}`;

  if (!src) {
    return (
      <span className={`${box} grid place-items-center text-slate-300`} aria-hidden="true">
        <svg width={size === 'lg' ? 36 : 18} height={size === 'lg' ? 36 : 18} viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7l9-4 9 4-9 4-9-4Zm0 5l9 4 9-4M3 17l9 4 9-4" />
        </svg>
      </span>
    );
  }

  return <img src={imageSrc(src)} alt={alt} loading="lazy" className={box} />;
}
