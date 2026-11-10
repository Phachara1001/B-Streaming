<script setup>
import { computed } from 'vue'

const props = defineProps({
  seed: { type: Number, default: 7 },
  crowd: { type: Boolean, default: true },
  beams: { type: Number, default: 4 },
  tone: { type: String, default: 'violet' } // violet | pink | blue
})

function rng(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const people = computed(() => {
  const rand = rng(props.seed * 9973 + 11)
  const list = []
  const count = 26
  for (let i = 0; i < count; i++) {
    const x = (i + 0.5) * (1000 / count) + (rand() - 0.5) * 22
    const row = rand() > 0.55 ? 1 : 0
    const r = 11 + rand() * 7 + (row ? 0 : 3)
    const y = 150 - row * 20 - rand() * 12
    const arm = rand() > 0.62
    list.push({
      x,
      y,
      r,
      row,
      arm,
      armDx: (rand() - 0.5) * 26,
      armLen: 26 + rand() * 24
    })
  }
  return list.sort((a, b) => b.row - a.row)
})

const beamList = computed(() =>
  Array.from({ length: props.beams }, (_, i) => ({
    i,
    left: `${8 + (i * 84) / Math.max(1, props.beams - 1)}%`,
    delay: `${-i * 1.3}s`,
    dur: `${5 + (i % 3)}s`,
    rot: i % 2 ? 1 : -1
  }))
)
</script>

<template>
  <div class="scenery" :class="`tone-${tone}`" aria-hidden="true">
    <div class="sc-haze"></div>
    <div class="sc-beams">
      <i v-for="b in beamList" :key="b.i" class="sc-beam"
        :style="{ left: b.left, animationDelay: b.delay, animationDuration: b.dur, '--rot': b.rot }"></i>
    </div>
    <div class="sc-dust">
      <i v-for="n in 14" :key="n" :style="{ '--n': n }"></i>
    </div>
    <svg v-if="crowd" class="sc-crowd" viewBox="0 0 1000 170" preserveAspectRatio="none">
      <g fill="#1d0f45">
        <g v-for="(p, idx) in people" :key="idx" :opacity="p.row ? 0.72 : 1">
          <line v-if="p.arm" :x1="p.x" :y1="p.y + 6" :x2="p.x + p.armDx" :y2="p.y - p.armLen" stroke="#1d0f45"
            stroke-width="7" stroke-linecap="round" />
          <circle :cx="p.x" :cy="p.y" :r="p.r" />
          <path :d="`M ${p.x - p.r * 1.9} 175 Q ${p.x - p.r * 1.9} ${p.y + p.r + 4} ${p.x} ${p.y + p.r + 2} Q ${p.x + p.r * 1.9} ${p.y + p.r + 4} ${p.x + p.r * 1.9} 175 Z`" />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.scenery {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.sc-haze {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(60% 45% at 50% 0%, rgba(255, 255, 255, 0.35), transparent 70%),
    radial-gradient(50% 50% at 15% 100%, rgba(255, 90, 220, 0.4), transparent 70%),
    radial-gradient(50% 50% at 90% 90%, rgba(90, 120, 255, 0.4), transparent 70%);
}

.sc-beams {
  position: absolute;
  inset: 0;
  mix-blend-mode: screen;
}

.sc-beam {
  position: absolute;
  top: -10%;
  width: 22%;
  height: 120%;
  margin-left: -11%;
  transform-origin: 50% 0%;
  clip-path: polygon(46% 0, 54% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.85), rgba(190, 150, 255, 0.35) 45%, transparent 90%);
  opacity: 0.55;
  filter: blur(2px);
  animation-name: sway;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}

.tone-pink .sc-beam { background: linear-gradient(180deg, rgba(255, 255, 255, 0.85), rgba(255, 120, 220, 0.4) 45%, transparent 90%); }
.tone-blue .sc-beam { background: linear-gradient(180deg, rgba(255, 255, 255, 0.85), rgba(120, 160, 255, 0.4) 45%, transparent 90%); }

@keyframes sway {
  from { transform: rotate(calc(var(--rot) * -16deg)); }
  to { transform: rotate(calc(var(--rot) * 16deg)); }
}

.sc-dust i {
  position: absolute;
  left: calc(var(--n) * 7%);
  bottom: 12%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #fff;
  opacity: 0;
  animation: dust 6s calc(var(--n) * -0.7s) linear infinite;
}

@keyframes dust {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  20% { opacity: 0.9; }
  100% { transform: translateY(-260px) scale(1.4); opacity: 0; }
}

.sc-crowd {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 28%;
  min-height: 70px;
}

@media (prefers-reduced-motion: reduce) {
  .sc-beam, .sc-dust i { animation: none; }
}
</style>

