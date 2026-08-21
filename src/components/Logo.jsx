/**
 * Official Dav-Ric Group logo.
 *
 * The source file has a transparent background with black lettering,
 * so it must sit on a white or very light surface. Never place it on
 * the brand red -- use the red as an accent bar beside it instead.
 */
export default function Logo({ className = '', size = 'md' }) {
  const heights = {
    sm: 'h-8',
    md: 'h-11',
    lg: 'h-16',
    xl: 'h-24',
  }

  return (
    <img
      src="/davric-logo.webp"
      alt="Dav-Ric Group of Companies"
      width={320}
      height={144}
      className={`${heights[size]} w-auto select-none ${className}`}
      draggable={false}
    />
  )
}
