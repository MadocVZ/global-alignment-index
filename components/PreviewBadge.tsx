'use client'
export default function PreviewBadge() {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV !== 'preview') return null
  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 50,
        background: 'rgba(0,0,0,0.6)',
        color: 'white',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 12,
        letterSpacing: 0.2,
        backdropFilter: 'blur(4px)',
      }}
      aria-label="Preview build"
      title="This is a Vercel Preview deployment"
    >
      Preview
    </div>
  )
}
