<script setup>
defineProps({
  size: { type: Number, default: 50 }
})
</script>

<template>
  <span class="bs-logo" :style="{ width: size + 'px', height: size + 'px' }" aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bsLogoGrad" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" style="stop-color: var(--pop-pink)" />
          <stop offset="1" style="stop-color: var(--pop-orange)" />
        </linearGradient>
        <clipPath id="bsLogoClip">
          <rect x="2" y="2" width="44" height="44" rx="14" />
        </clipPath>
      </defs>

      <g class="bs-tile">
        <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#bsLogoGrad)" style="stroke: var(--ink)"
          stroke-width="2.5" />

        <!-- glossy sweep -->
        <g clip-path="url(#bsLogoClip)">
          <rect class="bs-shine" x="-20" y="-6" width="12" height="60" fill="#ffffff" opacity="0.5"
            transform="rotate(20 24 24)" />
        </g>

        <!-- letter B: draws itself, then breathes -->
        <g class="bs-letter">
          <path d="M16 12 H26 a6.5 6.5 0 0 1 0 13 H16 M16 25 H28 a6.5 6.5 0 0 1 0 13 H16 V12" style="stroke: var(--ink)"
            stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.18"
            transform="translate(1.5 1.5)" />
          <path class="bs-letter-stroke" pathLength="100"
            d="M16 12 H26 a6.5 6.5 0 0 1 0 13 H16 M16 25 H28 a6.5 6.5 0 0 1 0 13 H16 V12" stroke="#ffffff"
            stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        </g>

        <!-- sound waves -->
        <path class="bs-wave bs-wave-1" d="M37 10 a9 9 0 0 1 0 12" style="stroke: var(--pop-yellow)" stroke-width="3"
          stroke-linecap="round" />
        <path class="bs-wave bs-wave-2" d="M41 6.5 a14 14 0 0 1 0 19" style="stroke: var(--pop-yellow)"
          stroke-width="3" stroke-linecap="round" />
      </g>
    </svg>
  </span>
</template>

<style scoped>
.bs-logo {
  display: inline-block;
  animation: bsFloat 4.5s ease-in-out infinite;
  transform-origin: 50% 60%;
}

.bs-logo svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

.bs-logo:hover {
  animation: bsWiggle 0.7s ease-in-out;
}

.bs-tile {
  transform-box: fill-box;
  transform-origin: center;
  animation: bsPop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.bs-letter-stroke {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: bsDraw 1.1s 0.35s cubic-bezier(0.65, 0, 0.35, 1) forwards;
}

.bs-letter {
  transform-box: fill-box;
  transform-origin: center;
  animation: bsBreathe 2.6s 1.6s ease-in-out infinite;
}

.bs-wave {
  opacity: 0;
  animation: bsWave 1.8s 1.2s ease-in-out infinite;
}

.bs-wave-2 {
  animation-delay: 1.5s;
}

.bs-shine {
  animation: bsShine 4.2s 2s ease-in-out infinite;
}

@keyframes bsPop {
  from { transform: scale(0.4) rotate(-25deg); opacity: 0; }
  to { transform: scale(1) rotate(0); opacity: 1; }
}

@keyframes bsDraw {
  to { stroke-dashoffset: 0; }
}

@keyframes bsBreathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

@keyframes bsWave {
  0% { opacity: 0; transform: translateX(-2px); }
  35% { opacity: 1; transform: translateX(0); }
  70%, 100% { opacity: 0; transform: translateX(2px); }
}

@keyframes bsShine {
  0% { transform: translateX(0) rotate(20deg); }
  45%, 100% { transform: translateX(95px) rotate(20deg); }
}

@keyframes bsFloat {
  0%, 100% { transform: translateY(0) rotate(-6deg); }
  50% { transform: translateY(-3px) rotate(-3deg); }
}

@keyframes bsWiggle {
  0%, 100% { transform: rotate(-6deg) scale(1); }
  25% { transform: rotate(8deg) scale(1.12); }
  50% { transform: rotate(-10deg) scale(1.12); }
  75% { transform: rotate(5deg) scale(1.08); }
}

@media (prefers-reduced-motion: reduce) {
  .bs-logo,
  .bs-tile,
  .bs-letter,
  .bs-wave,
  .bs-shine {
    animation: none;
  }

  .bs-letter-stroke {
    animation: none;
    stroke-dashoffset: 0;
  }

  .bs-wave {
    opacity: 1;
  }
}
</style>

