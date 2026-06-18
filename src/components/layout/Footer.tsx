export function Footer() {
  return (
    <footer className="h-9 flex items-center justify-between px-4 bg-bg-secondary border-t border-border-primary flex-shrink-0 text-2xs">
      {/* Status — like Hyperliquid's bottom-left "Online" */}
      <div className="flex items-center gap-1.5 text-text-secondary">
        <span className="w-1.5 h-1.5 rounded-full bg-long" />
        <span>Online</span>
      </div>

      {/* Credit + contact */}
      <div className="flex items-center gap-1 text-text-secondary">
        <span>Made by</span>
        <a
          href="https://github.com/CyphCube"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-primary font-medium hover:text-accent-blue transition-colors"
        >
          CyphCube
        </a>
        <span>with</span>
        <span className="text-short">♥</span>
        <span className="text-text-muted mx-1">·</span>
        <a
          href="mailto:info@cyphcube.com"
          className="text-accent-blue hover:text-accent-blue-dim transition-colors"
        >
          info@cyphcube.com
        </a>
      </div>
    </footer>
  )
}
