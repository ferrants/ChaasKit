/**
 * Loading skeleton for chat pages with sidebar.
 * Used as SSR fallback for routes that render the full chat interface.
 */
export function ChatLoadingSkeleton() {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar skeleton */}
      <div
        style={{
          width: '256px',
          backgroundColor: 'rgb(var(--color-sidebar))',
          borderRight: '1px solid rgb(var(--color-border))',
          padding: '1rem',
        }}
      >
        <div
          style={{
            height: '2rem',
            backgroundColor: 'rgb(var(--color-background-secondary))',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
          }}
        />
        <div
          style={{
            height: '1rem',
            backgroundColor: 'rgb(var(--color-background-secondary))',
            borderRadius: '0.25rem',
            width: '80%',
          }}
        />
      </div>
      {/* Main content skeleton */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgb(var(--color-background))',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '2rem',
              height: '2rem',
              border: '2px solid rgb(var(--color-primary))',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'chaaskit-spin 1s linear infinite',
            }}
          />
          <p style={{ color: 'rgb(var(--color-text-muted))' }}>Loading...</p>
        </div>
      </div>
      <style>
        {`
          @keyframes chaaskit-spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

/**
 * Simple centered loading spinner skeleton.
 * Used as SSR fallback for simple pages without sidebar.
 */
export function SimpleLoadingSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgb(var(--color-background))',
      }}
    >
      <div
        style={{
          width: '2rem',
          height: '2rem',
          border: '2px solid rgb(var(--color-primary))',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'chaaskit-spin 1s linear infinite',
        }}
      />
      <style>
        {`
          @keyframes chaaskit-spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}
