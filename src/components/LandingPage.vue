<script setup>
import { Play, Music, Music2, Crown, Sparkles } from 'lucide-vue-next'
import BrandLogo from './BrandLogo.vue'
import MicArt from './MicArt.vue'
import StageScenery from './StageScenery.vue'
import ThemeSwitcher from './ThemeSwitcher.vue'

const emit = defineEmits(['enter'])
</script>

<template>
  <main class="cv">
    <StageScenery :seed="5" :beams="5" />

    <header class="cv-top">
      <div class="cv-brand">
        <span class="cv-logo"><BrandLogo :size="46" class="logo-purple" /></span>
        <div class="cv-brand-text">
          <strong>B-Streaming</strong>
          <span>Stream. Sing. Share.</span>
        </div>
        <span class="cv-live"><i></i>LIVE</span>
      </div>
      <div class="cv-top-right">
        <ThemeSwitcher />
      </div>
    </header>

    <Music class="note n1" :size="34" />
    <Music2 class="note n2" :size="26" />
    <Music class="note n3" :size="22" />
    <Sparkles class="note n4" :size="24" />

    <section class="cv-main">
      <div class="cv-copy">
        <Crown class="cv-crown" :size="40" />
        <h1 class="cv-title">
          <span class="line1">B-Streaming</span>
          <span class="line2">Karaoke</span>
        </h1>
        <p class="cv-ribbon"><span>ร้องได้ ทุกที่ ทุกเวลา</span></p>
        <p class="cv-desc">สร้างห้อง สแกน QR แล้วให้ทุกคนส่งเพลงจากมือถือขึ้นจอได้ทันที พร้อมคิวเพลงและประวัติการเล่น</p>

        <button type="button" class="cv-enter" @click="emit('enter')">
          <span class="play"><Play :size="20" /></span>
          <span class="label">ENTER TO KARAOKE</span>
          <i class="shine"></i>
        </button>
      </div>

      <div class="cv-mic">
        <span class="mic-glow"></span>
        <MicArt />
      </div>
    </section>
  </main>
</template>

<style scoped>
.cv {
  position: fixed;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: #fff;
  font-family: var(--font-sans);
  background:
    radial-gradient(90% 70% at 70% 30%, #a24dff 0%, transparent 60%),
    radial-gradient(80% 60% at 10% 90%, #ff4fd0 0%, transparent 55%),
    linear-gradient(160deg, #3a1fb0 0%, #6a35e6 45%, #b04dff 100%);
}

.cv-top {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px 34px;
}

.cv-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cv-logo {
  display: inline-flex;
  padding: 4px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 24px rgba(40, 10, 120, 0.4);
}

.logo-purple {
  --pop-pink: #ff3fb4;
  --pop-orange: #8a4dff;
  --pop-yellow: #ffe27a;
  --ink: #2a1573;
}

.cv-brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.cv-brand-text strong {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.cv-brand-text span {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.9;
}

.cv-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  background: #22d56b;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  box-shadow: 0 4px 14px rgba(34, 213, 107, 0.55);
}

.cv-live i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fff;
  animation: blink 1.2s ease-in-out infinite;
}

@keyframes blink {
  50% { opacity: 0.3; }
}

.cv-main {
  position: relative;
  z-index: 5;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  align-items: center;
  gap: 20px;
  padding: 0 6vw 8vh;
}

.cv-copy {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  animation: rise 0.9s cubic-bezier(0.22, 1.2, 0.36, 1) both;
}

@keyframes rise {
  from { opacity: 0; transform: translateY(34px); }
  to { opacity: 1; transform: none; }
}

.cv-crown {
  color: #ffd96b;
  filter: drop-shadow(0 4px 10px rgba(255, 200, 60, 0.7));
  transform: rotate(-14deg);
  margin-bottom: -18px;
  margin-left: 6px;
}

.cv-title {
  display: flex;
  flex-direction: column;
  line-height: 0.95;
}

.cv-title .line1 {
  font-size: clamp(46px, 7.2vw, 108px);
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #fff;
  -webkit-text-stroke: 7px #3a1d99;
  paint-order: stroke fill;
  text-shadow: 0 8px 0 #2a1573, 0 18px 36px rgba(30, 8, 100, 0.55);
}

.cv-title .line2 {
  margin-top: 4px;
  font-size: clamp(56px, 9.4vw, 140px);
  font-weight: 800;
  font-style: italic;
  letter-spacing: -0.03em;
  background: linear-gradient(180deg, #ff9bf0 0%, #ff3fb4 55%, #e11d9c 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: 7px #fff;
  paint-order: stroke fill;
  filter: drop-shadow(0 8px 0 #7a1b9a) drop-shadow(0 16px 28px rgba(255, 63, 180, 0.55));
}

.cv-ribbon {
  margin-top: 6px;
  transform: rotate(-3deg);
}

.cv-ribbon span {
  display: inline-block;
  padding: 10px 40px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.8));
  color: #5b2bd9;
  font-size: clamp(20px, 2.4vw, 32px);
  font-weight: 800;
  border-radius: 6px 22px 6px 22px;
  box-shadow: 0 10px 24px rgba(40, 10, 120, 0.35);
}

.cv-desc {
  max-width: 480px;
  font-size: 15px;
  line-height: 1.55;
  font-weight: 500;
  opacity: 0.92;
}

.cv-enter {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  gap: 16px;
  margin-top: 14px;
  height: 72px;
  padding: 0 40px 0 14px;
  border: 3px solid rgba(255, 255, 255, 0.9);
  border-radius: 999px;
  background: linear-gradient(180deg, #ff6ad9 0%, #ff2fae 55%, #d9168f 100%);
  color: #fff;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow: 0 0 0 6px rgba(255, 63, 180, 0.28), 0 18px 40px rgba(255, 47, 174, 0.55), inset 0 2px 0 rgba(255, 255, 255, 0.5);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  animation: pulse 2.4s ease-in-out infinite;
}

.cv-enter:hover {
  transform: translateY(-3px) scale(1.03);
}

.cv-enter:active {
  transform: translateY(1px) scale(0.98);
}

@keyframes pulse {
  50% { box-shadow: 0 0 0 12px rgba(255, 63, 180, 0.12), 0 18px 40px rgba(255, 47, 174, 0.55), inset 0 2px 0 rgba(255, 255, 255, 0.5); }
}

.cv-enter .play {
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fff;
  color: #e11d9c;
  box-shadow: 0 4px 10px rgba(120, 10, 90, 0.35);
}

.cv-enter .play svg {
  margin-left: 3px;
  fill: currentColor;
}

.cv-enter .shine {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 60px;
  left: -80px;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.55), transparent);
  transform: skewX(-20deg);
  animation: sweep 3.6s ease-in-out infinite;
}

@keyframes sweep {
  0% { left: -80px; }
  45%, 100% { left: 110%; }
}

.cv-mic {
  position: relative;
  justify-self: center;
  width: min(34vw, 380px);
  height: min(70vh, 640px);
  animation: bob 4.5s ease-in-out infinite;
}

.mic-glow {
  position: absolute;
  inset: 8% -20% 20%;
  background: radial-gradient(circle, rgba(255, 140, 240, 0.65), transparent 65%);
  filter: blur(26px);
}

@keyframes bob {
  0%, 100% { transform: translateY(0) rotate(8deg); }
  50% { transform: translateY(-14px) rotate(5deg); }
}

.note {
  position: absolute;
  z-index: 4;
  color: #fff;
  opacity: 0.85;
  filter: drop-shadow(0 4px 10px rgba(255, 120, 230, 0.7));
  animation: floaty 5s ease-in-out infinite;
}

.note.n1 { right: 8%; top: 12%; }
.note.n2 { right: 30%; top: 20%; animation-delay: -1.5s; }
.note.n3 { left: 46%; top: 12%; animation-delay: -3s; }
.note.n4 { right: 4%; top: 56%; animation-delay: -2s; color: #ffe27a; }

@keyframes floaty {
  0%, 100% { transform: translateY(0) rotate(-8deg); }
  50% { transform: translateY(-18px) rotate(10deg); }
}

@media (max-width: 860px) {
  .cv-main {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
    padding: 0 20px 14vh;
    overflow-y: auto;
  }
  .cv-copy { align-items: center; }
  .cv-mic { position: absolute; right: -40px; bottom: 6vh; width: 160px; height: 300px; opacity: 0.5; z-index: -1; }
  .cv-top { padding: 16px 18px; }
  .cv-enter { height: 62px; font-size: 18px; padding-right: 28px; }
}

@media (prefers-reduced-motion: reduce) {
  .cv-mic, .note, .cv-enter, .cv-enter .shine, .cv-copy { animation: none; }
}
</style>
