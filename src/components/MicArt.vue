<template>
  <svg class="mic-art" viewBox="0 0 240 460" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <radialGradient id="micHead" cx="38%" cy="30%" r="80%">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="0.35" stop-color="#d9c9ff" />
        <stop offset="0.75" stop-color="#8a63ff" />
        <stop offset="1" stop-color="#4326b8" />
      </radialGradient>
      <linearGradient id="micBody" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#2a1573" />
        <stop offset="0.3" stop-color="#7a55ee" />
        <stop offset="0.5" stop-color="#e5dcff" />
        <stop offset="0.72" stop-color="#6a47d8" />
        <stop offset="1" stop-color="#25126a" />
      </linearGradient>
      <linearGradient id="micRing" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#3a1d99" />
        <stop offset="0.45" stop-color="#ffffff" />
        <stop offset="1" stop-color="#4c2ac4" />
      </linearGradient>
      <linearGradient id="micOrbit" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ff4fd0" stop-opacity="0" />
        <stop offset="0.5" stop-color="#ff7ae6" />
        <stop offset="1" stop-color="#8fb4ff" stop-opacity="0" />
      </linearGradient>
      <clipPath id="micClip">
        <ellipse cx="120" cy="108" rx="84" ry="96" />
      </clipPath>
      <pattern id="micGrid" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="13" height="13" fill="none" />
        <path d="M0 0H13M0 0V13" stroke="#2c1a78" stroke-opacity="0.55" stroke-width="2.2" />
      </pattern>
    </defs>

    <ellipse cx="120" cy="440" rx="62" ry="10" fill="#1a0b4a" opacity="0.35" />

    <!-- handle -->
    <path d="M78 205 L162 205 L146 408 Q120 422 94 408 Z" fill="url(#micBody)" />
    <path d="M96 215 L104 215 L100 400 L96 398 Z" fill="#fff" opacity="0.32" />
    <rect x="88" y="300" width="64" height="9" rx="4.5" fill="#25126a" opacity="0.55" />
    <rect x="92" y="330" width="56" height="7" rx="3.5" fill="#25126a" opacity="0.4" />

    <!-- ring -->
    <rect x="64" y="186" width="112" height="34" rx="15" fill="url(#micRing)" />
    <rect x="64" y="186" width="112" height="34" rx="15" fill="none" stroke="#3b1f9e" stroke-opacity="0.5" stroke-width="2" />

    <!-- head -->
    <ellipse cx="120" cy="108" rx="84" ry="96" fill="url(#micHead)" />
    <g clip-path="url(#micClip)">
      <rect x="30" y="8" width="180" height="204" fill="url(#micGrid)" />
      <ellipse cx="88" cy="62" rx="34" ry="44" fill="#fff" opacity="0.4" transform="rotate(-24 88 62)" />
    </g>
    <ellipse cx="120" cy="108" rx="84" ry="96" fill="none" stroke="#3a1d99" stroke-opacity="0.55" stroke-width="3" />

    <!-- orbit ring -->
    <g class="mic-orbit">
      <ellipse cx="120" cy="228" rx="112" ry="26" fill="none" stroke="url(#micOrbit)" stroke-width="5"
        stroke-linecap="round" />
    </g>
  </svg>
</template>

<style scoped>
.mic-art {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
  filter: drop-shadow(0 24px 30px rgba(36, 10, 110, 0.55));
}

.mic-orbit {
  transform-box: fill-box;
  transform-origin: center;
  animation: orbit 5s linear infinite;
}

@keyframes orbit {
  from { transform: rotate(-14deg) scaleX(1); }
  50% { transform: rotate(-14deg) scaleX(-1); }
  to { transform: rotate(-14deg) scaleX(1); }
}

@media (prefers-reduced-motion: reduce) {
  .mic-orbit { animation: none; }
}
</style>

