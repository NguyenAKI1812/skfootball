import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function syncMobileLandscapeViewport() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const isTouch = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const isLandscape = window.matchMedia?.('(orientation: landscape)').matches ?? (window.innerWidth > window.innerHeight);
  const shortSide = Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight);
  const useDesktopScaled = isTouch && isLandscape && shortSide <= 560;

  if (useDesktopScaled) {
    if (meta.getAttribute('content') !== 'width=1280, viewport-fit=cover') {
      meta.setAttribute('content', 'width=1280, viewport-fit=cover');
    }
    document.documentElement.classList.add('mobile-landscape-pc');
  } else {
    if (meta.getAttribute('content') !== 'width=device-width, initial-scale=1.0, viewport-fit=cover') {
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
    }
    document.documentElement.classList.remove('mobile-landscape-pc');
  }
}

syncMobileLandscapeViewport();
window.addEventListener('resize', syncMobileLandscapeViewport);
window.addEventListener('orientationchange', syncMobileLandscapeViewport);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
