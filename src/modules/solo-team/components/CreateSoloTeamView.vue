<template>
  <div class="create-solo-team-view">
    <div class="content-wrapper">
      <!-- 顶部人物头像群组 -->
      <div class="people-group">
        <div class="people-item people-1">
          <img :src="people1" alt="people" />
        </div>
        <div class="people-item people-2">
          <img :src="people2" alt="people" />
        </div>
        <div class="people-item people-3">
          <img :src="people3" alt="people" />
        </div>
        <div class="people-item people-4">
          <img :src="people4" alt="people" />
        </div>
        <div class="people-item people-5">
          <img :src="people5" alt="people" />
        </div>
        <div class="people-item people-6">
          <img :src="people6" alt="people" />
        </div>
        <div class="people-item people-7">
          <img :src="people7" alt="people" />
        </div>
        <div class="people-item line">
          <img :src="lineImg" alt="line" />
        </div>
        <div class="people-item tip-1">
          🚩 超级团队，啥活都能扛~
        </div>
        <div class="people-item tip-2">
          有我在，🚀 研发效率直接起飞！
        </div>
        <div class="people-item tip-3">
          数字人就位，研发难题全退退退 🤺
        </div>
      </div>

      <!-- 标题图片 -->
      <div class="title-section">
        <img :src="titleImg" alt="Kooky 一人团队" class="title-img" />
      </div>

      <!-- 创建按钮 -->
      <button type="button" class="create-btn" @click="emit('create')">
        新建数字员工
      </button>
    </div>
  </div>
</template>

<script setup>
import people1 from '@/assets/soloTeam/people_1.png'
import people2 from '@/assets/soloTeam/people_2.png'
import people3 from '@/assets/soloTeam/people_3.png'
import people4 from '@/assets/soloTeam/people_4.png'
import people5 from '@/assets/soloTeam/people_5.png'
import people6 from '@/assets/soloTeam/people_6.png'
import people7 from '@/assets/soloTeam/people_7.png'
import titleImg from '@/assets/soloTeam/title.png'
import lineImg from '@/assets/soloTeam/line.png'
const emit = defineEmits(['create'])
</script>

<style lang="scss" scoped>
.create-solo-team-view {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #FFF5F5 0%, #FFFFFF 100%);
  overflow: auto;
  position: relative;

  // 背景图片 - 占页面高度的一半
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    background: url('@/assets/soloTeam/bg.png') no-repeat center top;
    background-size: cover;
    z-index: 0;
  }
  .line {
    top: 70px;
    left: 154px;
  }
  .tip-1 {
    top: 30px;
    left: 86px;
    font-size: 12px;
    border-radius: 60px;
    background: linear-gradient(180deg, rgba(216, 216, 216, 0.5) 0%, rgba(248, 248, 250, 0.5) 99%);
    box-sizing: border-box;
    backdrop-filter: blur(5px) saturate(100%);
    padding: 8px 20px;
    border: 1px solid #fff;
  }
  .tip-2 {
    top: 260px;
    left: 4px;
    font-size: 12px;
    border-radius: 60px;
    background: linear-gradient(180deg, rgba(216, 216, 216, 0.5) 0%, rgba(248, 248, 250, 0.5) 99%);
    box-sizing: border-box;
    backdrop-filter: blur(5px) saturate(100%);
    padding: 8px 20px;
    border: 1px solid #fff;
  }
  .tip-3 {
    top: 110px;
    left: 620px;
    font-size: 12px;
    border-radius: 60px;
    background: linear-gradient(180deg, rgba(216, 216, 216, 0.5) 0%, rgba(248, 248, 250, 0.5) 99%);
    box-sizing: border-box;
    backdrop-filter: blur(5px) saturate(100%);
    padding: 8px 20px;
    border: 1px solid #fff;
  }
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  // padding: 40px 20px;
  max-width: 854px;
  width: 100%;
  position: relative;
  z-index: 1;
}

.people-group {
  position: relative;
  width: 100%;
  height: 280px;
}

.people-item {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.people-1 img {
  width: 114px;
  height: 114px;
}
.people-2 img {
  width: 160px;
  height: 160px;
}
.people-3 img {
  width: 112px;
  height: 112px;
}
.people-4 img {
  width: 103px;
  height: 103px;
}
.people-5 img {
  width: 150px;
  height: 150px;
}
.people-6 img {
  width: 54px;
  height: 54px;
}
.people-7 img {
  width: 103px;
  height: 103px;
}
.line img {
  width: 45px;
  height: 28px;
}

// 人物位置布局（参考UI图）
.people-1 {
  top: 124px;
  left: 20px;
  animation: float1 5s ease-in-out infinite;
}

.people-2 {
  top: 106px;
  left: 152px;
  animation: float2 5.5s ease-in-out infinite;
}

.people-3 {
  top: 44px;
  left: 300px;
  animation: float3 5.2s ease-in-out infinite;
}

.people-4 {
  top: 170px;
  left: 338px;
  animation: float4 5.8s ease-in-out infinite;
}

.people-5 {
  top: 90px;
  left: 450px;
  animation: float5 5.3s ease-in-out infinite;
}

.people-6 {
  top: 40px;
  left: 580px;
  animation: float6 5.6s ease-in-out infinite;
}

.people-7 {
  top: 146px;
  left: 615px;
  animation: float7 5.4s ease-in-out infinite;
}

// 无规则运动动画（每个头像在4px范围内移动）
@keyframes float1 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(2px, -3px); }
  50% { transform: translate(-3px, 2px); }
  75% { transform: translate(3px, 3px); }
}

@keyframes float2 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-2px, 3px); }
  50% { transform: translate(3px, -2px); }
  75% { transform: translate(-3px, -3px); }
}

@keyframes float3 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(3px, 2px); }
  50% { transform: translate(-2px, -3px); }
  75% { transform: translate(2px, 3px); }
}

@keyframes float4 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-3px, -2px); }
  50% { transform: translate(2px, 3px); }
  75% { transform: translate(-2px, 2px); }
}

@keyframes float5 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(3px, -3px); }
  50% { transform: translate(-3px, 3px); }
  75% { transform: translate(2px, -2px); }
}

@keyframes float6 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-2px, 2px); }
  50% { transform: translate(3px, -3px); }
  75% { transform: translate(-3px, 2px); }
}

@keyframes float7 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(2px, 3px); }
  50% { transform: translate(-3px, -2px); }
  75% { transform: translate(3px, -3px); }
}

.title-section {
  margin-bottom: 16px;
  .title-img {
    height: 187px;
    width: 352px;
  }
}

.subtitle {
  font-size: 20px;
  font-weight: 500;
  color: #333;
  margin-bottom: 12px;
  text-align: center;
}

.description {
  font-size: 14px;
  color: #999;
  margin-bottom: 40px;
  text-align: center;
}

.create-btn {
  padding: 14px 48px;
  background:
    linear-gradient(#000, #000) padding-box,
    linear-gradient(90deg, #FF8670 0%, #AD85FF 55%, #77C9FB 100%) border-box;
  border: 4px solid transparent;
  border-radius: 20px;
  color: white;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(173, 133, 255, 0.4);
  }

  &:active {
    transform: scale(1.05);
  }
}
</style>
