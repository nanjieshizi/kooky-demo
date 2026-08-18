<template>
  <svg
    class="nav-ico"
    :class="`nav-ico--${name}`"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- 我的分身：Kooky 螃蟹（钳子开合 + 眼柄轻晃）-->
    <g v-if="name === 'deerflow' || name === 'avatar'">
      <!-- 眼柄 + 眼 -->
      <g class="ico-stalk ico-stalk--l">
        <path d="M12.8 13.4v-2.6" />
        <circle cx="12.8" cy="9.2" r="1.5" fill="currentColor" stroke="none" />
      </g>
      <g class="ico-stalk ico-stalk--r">
        <path d="M19.2 13.4v-2.6" />
        <circle cx="19.2" cy="9.2" r="1.5" fill="currentColor" stroke="none" />
      </g>
      <!-- 蟹壳 -->
      <rect class="ico-fill" x="8" y="13.4" width="16" height="9.4" rx="4.7" />
      <!-- 蟹腿 -->
      <path d="M10.6 22.6 9.4 25.6" />
      <path d="M14.2 23 13.6 26" />
      <path d="M17.8 23 18.4 26" />
      <path d="M21.4 22.6 22.6 25.6" />
      <!-- 左钳 -->
      <path d="M8 16.8 5.8 15.6" />
      <path class="claw-jaw claw-jaw--lu" d="M5.8 15.6 3.2 13.6" />
      <path class="claw-jaw claw-jaw--ld" d="M5.8 15.6 3 16.9" />
      <!-- 右钳 -->
      <path d="M24 16.8 26.2 15.6" />
      <path class="claw-jaw claw-jaw--ru" d="M26.2 15.6 28.8 13.6" />
      <path class="claw-jaw claw-jaw--rd" d="M26.2 15.6 29 16.9" />
    </g>

    <!-- Kode：终端（提示符前推 + 光标闪）-->
    <g v-else-if="name === 'cli'">
      <rect class="ico-fill" x="5.8" y="8.2" width="20.4" height="16.6" rx="5.6" />
      <path class="ico-caret" d="M11 14.3l2.6 2.3-2.6 2.3" />
      <path class="ico-cursor" d="M16.8 19.3h4.4" />
    </g>

    <!-- 一人团队：我带队（中间是我，环绕的是数字员工，hover 依次就位）-->
    <g v-else-if="name === 'solo-team'">
      <!-- 我 -->
      <circle class="ico-fill" cx="16" cy="16.6" r="3.5" />
      <path d="M10.4 25.4c0-3.1 2.5-5 5.6-5s5.6 1.9 5.6 5" />
      <!-- 数字员工 -->
      <circle class="ico-node ico-node--1" cx="16" cy="6.2" r="2.3" />
      <circle class="ico-node ico-node--2" cx="5.9" cy="12.4" r="2.3" />
      <circle class="ico-node ico-node--3" cx="26.1" cy="12.4" r="2.3" />
    </g>

    <!-- 协作：双拳（碰拳）-->
    <g v-else-if="name === 'collaboration'">
      <g class="ico-fist ico-fist--l">
        <rect class="ico-fill" x="2.6" y="12.4" width="11.8" height="10.4" rx="4.8" />
        <path d="M5.8 12.4v-1.2a1.9 1.9 0 0 1 3.8 0v1.2" />
        <path d="M11.4 15.1v5" />
      </g>
      <g class="ico-fist ico-fist--r">
        <rect class="ico-fill" x="17.6" y="12.4" width="11.8" height="10.4" rx="4.8" />
        <path d="M22.4 12.4v-1.2a1.9 1.9 0 0 1 3.8 0v1.2" />
        <path d="M20.6 15.1v5" />
      </g>
    </g>

    <!-- 市场：圆 + 波浪（波浪流动）-->
    <g v-else-if="name === 'market'">
      <defs>
        <clipPath id="kk-nav-mkt-clip">
          <circle cx="16" cy="16" r="8.4" />
        </clipPath>
      </defs>
      <circle class="ico-fill" cx="16" cy="16" r="9.2" />
      <g clip-path="url(#kk-nav-mkt-clip)">
        <path class="ico-wave" d="M-0.4 18.6c2.1-3.1 4-3.1 6 0s3.9 3.1 6 0 4-3.1 6 0 3.9 3.1 6 0 4-3.1 6 0" />
      </g>
    </g>

    <!-- 星芒：跟着各自动效的节拍亮，不常驻脉冲 -->
    <path
      v-if="spark"
      class="ico-spark"
      :d="sparkPath"
      fill="currentColor"
      stroke="none"
    />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
})

// 市场是闭合圆、一人团队右上角已被员工节点占住，都不挂星芒
const spark = computed(() => !['market', 'solo-team'].includes(props.name))

// 协作的星芒落在两拳相碰处（正上方），其余落右上角
const sparkPath = computed(() =>
  props.name === 'collaboration'
    ? 'M16 5.6l.8 2.05 2.05.8-2.05.8-.8 2.05-.8-2.05L13.15 8.45l2.05-.8z'
    : 'M25.4 4.2l.85 2.15 2.15.85-2.15.85-.85 2.15-.85-2.15L22.4 7.2l2.15-.85z',
)
</script>

<!-- 不用 scoped：动效由祖先 .primary-nav-item 的 hover/active 驱动，
     而 Vue 的 scoped 编译会把 :global(X) Y 里的后代 Y 丢掉（只剩 X），
     导致动画错挂到按钮上、五个图标共用一个效果。选择器全部锚在 .nav-ico / .ico-* 命名空间下。 -->
<style>
.nav-ico {
  width: 100%;
  height: 100%;
  color: #2f3547;
  overflow: visible;
  transition: color 0.2s ease;
}

/* ---- 选中态：线条染色 + 块面淡填充（颜色只表达「选中」，不参与 hover）---- */
.primary-nav-item.active .nav-ico {
  color: #8478fa;
}
.primary-nav-item.active .nav-ico .ico-fill {
  fill: rgba(132, 120, 250, 0.13);
}

/* 星芒：平时收着，选中时实心 */
.nav-ico .ico-spark {
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0.45;
  transition: opacity 0.2s ease;
}
.primary-nav-item.active .nav-ico .ico-spark {
  opacity: 1;
}

/* ---- 各自的 hover 动效（只动、不染色）---- */
.nav-ico .ico-stalk,
.nav-ico .ico-node,
.nav-ico .ico-caret,
.nav-ico .ico-cursor,
.nav-ico .ico-fist,
.nav-ico .ico-wave {
  transform-box: fill-box;
  transform-origin: center;
}

/* 钳子的两片颚要绕「关节」转，不是绕自身中心 —— 用 view-box 才能给出 viewBox 坐标系里的支点 */
.nav-ico .claw-jaw {
  transform-box: view-box;
}
.nav-ico .claw-jaw--lu,
.nav-ico .claw-jaw--ld {
  transform-origin: 5.8px 15.6px;
}
.nav-ico .claw-jaw--ru,
.nav-ico .claw-jaw--rd {
  transform-origin: 26.2px 15.6px;
}

/* 我的分身（螃蟹）：两只钳子开合一下 + 眼柄轻晃 */
.nav-ico .ico-stalk--l {
  transform-origin: bottom center;
}
.nav-ico .ico-stalk--r {
  transform-origin: bottom center;
}
.primary-nav-item:hover .nav-ico .ico-stalk--l {
  animation: kk-ico-wiggle 0.6s ease-in-out;
}
.primary-nav-item:hover .nav-ico .ico-stalk--r {
  animation: kk-ico-wiggle 0.6s ease-in-out reverse;
}
.primary-nav-item:hover .nav-ico .claw-jaw--lu,
.primary-nav-item:hover .nav-ico .claw-jaw--rd {
  animation: kk-claw-pos 0.6s ease-in-out;
}
.primary-nav-item:hover .nav-ico .claw-jaw--ld,
.primary-nav-item:hover .nav-ico .claw-jaw--ru {
  animation: kk-claw-neg 0.6s ease-in-out;
}

/* Kode：提示符前推 + 光标闪 */
.primary-nav-item:hover .nav-ico .ico-caret {
  animation: kk-ico-nudge 0.5s ease-in-out;
}
.primary-nav-item:hover .nav-ico .ico-cursor {
  animation: kk-ico-cursor-blink 0.62s steps(1, end) 2;
}

/* 一人团队：数字员工依次就位（错峰弹入）*/
.nav-ico .ico-node {
  opacity: 0.55;
  transition: opacity 0.2s ease;
}
.primary-nav-item:hover .nav-ico .ico-node,
.primary-nav-item.active .nav-ico .ico-node {
  opacity: 1;
}
.primary-nav-item:hover .nav-ico .ico-node--1 {
  animation: kk-ico-node-in 0.44s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.primary-nav-item:hover .nav-ico .ico-node--2 {
  animation: kk-ico-node-in 0.44s cubic-bezier(0.34, 1.56, 0.64, 1) 0.09s backwards;
}
.primary-nav-item:hover .nav-ico .ico-node--3 {
  animation: kk-ico-node-in 0.44s cubic-bezier(0.34, 1.56, 0.64, 1) 0.18s backwards;
}

/* 协作：碰拳 —— 两拳相向而行，撞上瞬间星芒炸一下 */
.primary-nav-item:hover .nav-ico .ico-fist--l {
  animation: kk-ico-bump-l 0.58s cubic-bezier(0.3, 0.9, 0.4, 1);
}
.primary-nav-item:hover .nav-ico .ico-fist--r {
  animation: kk-ico-bump-r 0.58s cubic-bezier(0.3, 0.9, 0.4, 1);
}
.primary-nav-item:hover .nav-ico--collaboration .ico-spark {
  animation: kk-ico-spark-hit 0.58s ease-out;
}

/* 市场：波浪流一下 */
.primary-nav-item:hover .nav-ico .ico-wave {
  animation: kk-ico-wave-flow 1.1s linear;
}

@keyframes kk-ico-wiggle {
  0%, 100% { transform: rotate(0deg); }
  30% { transform: rotate(-11deg); }
  65% { transform: rotate(9deg); }
}
@keyframes kk-claw-pos {
  0%, 100% { transform: rotate(0deg); }
  35% { transform: rotate(15deg); }
  62% { transform: rotate(3deg); }
}
@keyframes kk-claw-neg {
  0%, 100% { transform: rotate(0deg); }
  35% { transform: rotate(-15deg); }
  62% { transform: rotate(-3deg); }
}
@keyframes kk-ico-node-in {
  0% { transform: scale(0.35); opacity: 0.2; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes kk-ico-nudge {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(1.6px); }
}
@keyframes kk-ico-cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.15; }
}
@keyframes kk-ico-bump-l {
  0% { transform: translateX(0); }
  45% { transform: translateX(2.4px); }
  62% { transform: translateX(1.2px); }
  100% { transform: translateX(0); }
}
@keyframes kk-ico-bump-r {
  0% { transform: translateX(0); }
  45% { transform: translateX(-2.4px); }
  62% { transform: translateX(-1.2px); }
  100% { transform: translateX(0); }
}
@keyframes kk-ico-spark-hit {
  0%, 38% { opacity: 0; transform: scale(0.3); }
  50% { opacity: 1; transform: scale(1.45); }
  72% { opacity: 0.8; transform: scale(0.95); }
  100% { opacity: 0.45; transform: scale(1); }
}
@keyframes kk-ico-wave-flow {
  0% { transform: translateX(0); }
  100% { transform: translateX(-12px); }
}

@media (prefers-reduced-motion: reduce) {
  .nav-ico,
  .nav-ico * {
    animation: none !important;
    transition: none !important;
  }
}
</style>
