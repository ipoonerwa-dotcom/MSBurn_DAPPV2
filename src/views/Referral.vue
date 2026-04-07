<template>
  <div class="page">
    <div class="section-title" style="margin-top: 10px;">
      <span class="icon">👥</span>
      <span>推广中心</span>
    </div>

    <!-- 邀请链接 -->
    <div class="glass-card" style="margin-bottom: 16px;">
      <div class="section-title">
        <span class="icon">🔗</span>
        <span>我的邀请链接</span>
      </div>

      <div class="ref-link-box">
        <span class="ref-link-text">{{ refLink || '请先连接钱包' }}</span>
        <button class="copy-btn" @click="copyLink" v-if="wallet">
          📋
        </button>
      </div>

      <div class="share-btns">
        <button class="btn-primary" @click="copyLink" style="font-size: 14px;">
          📋 复制链接
        </button>
      </div>

      <div v-if="copied" class="copied-tip">已复制到剪贴板</div>
    </div>

    <!-- 推广数据 -->
    <div class="glass-card" style="margin-bottom: 16px;">
      <div class="section-title">
        <span class="icon">📊</span>
        <span>推广数据</span>
      </div>

      <div class="stats-grid" style="margin-bottom: 0;">
        <div class="stat-item">
          <div class="stat-value">{{ refInfo.l1 }}</div>
          <div class="stat-label">一代人数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ refInfo.l2 }}</div>
          <div class="stat-label">二代人数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ refInfo.active ? '活跃' : '未参与' }}</div>
          <div class="stat-label">本人状态</div>
        </div>
      </div>

      <div style="margin-top: 14px;">
        <div class="data-row">
          <span class="label">累计推广奖励</span>
          <span class="value highlight">{{ refInfo.refTotal }} 枚</span>
        </div>
        <div class="data-row">
          <span class="label">我的推荐人</span>
          <span class="value">{{ refInfo.referrer }}</span>
        </div>
      </div>
    </div>

    <!-- 规则说明 -->
    <div class="glass-card">
      <div class="section-title">
        <span class="icon">📖</span>
        <span>推广规则</span>
      </div>

      <div class="rules-list">
        <div class="rule-item">
          <span class="rule-num">1</span>
          <span>分享你的邀请链接，好友通过链接首次参与即绑定关系</span>
        </div>
        <div class="rule-item">
          <span class="rule-num">2</span>
          <span>一代推广奖励 <b class="gradient-text">15%</b>，二代推广奖励 <b class="gradient-text">10%</b></span>
        </div>
        <div class="rule-item">
          <span class="rule-num">3</span>
          <span>推荐人必须处于活跃状态（有仓位参与中）才能获得奖励</span>
        </div>
        <div class="rule-item">
          <span class="rule-num">4</span>
          <span>推广奖励计入出局进度（正拨比），与分红、排行榜奖共享2倍出局上限</span>
        </div>
        <div class="rule-item">
          <span class="rule-num">5</span>
          <span>推荐关系一旦绑定，永久有效</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted } from 'vue'
import { Contract } from 'ethers'
import { DAPP_ADDRESS, DAPP_ABI } from '../utils/contracts.js'
import { fmtToken, shortAddr, makeRefLink } from '../utils/helpers.js'

const props = defineProps(['wallet', 'provider', 'signer'])

const copied = ref(false)

const refInfo = reactive({
  referrer: '--',
  l1: '--',
  l2: '--',
  refTotal: '--',
  active: false,
})

const refLink = computed(() => {
  if (!props.wallet) return ''
  return makeRefLink(props.wallet)
})

async function loadRefInfo() {
  if (!props.provider || !props.wallet) return
  try {
    const dapp = new Contract(DAPP_ADDRESS, DAPP_ABI, props.provider)
    const info = await dapp.getUserRefInfo(props.wallet)
    refInfo.referrer = info.ref === '0x0000000000000000000000000000000000000000' ? '无' : info.ref
    refInfo.l1 = Number(info.l1).toString()
    refInfo.l2 = Number(info.l2).toString()
    refInfo.refTotal = fmtToken(info.refTotal)
    refInfo.active = info.active
  } catch (e) {
    console.error('loadRefInfo:', e)
  }
}

async function copyLink() {
  if (!refLink.value) return
  try {
    await navigator.clipboard.writeText(refLink.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = refLink.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

watch(() => props.wallet, loadRefInfo)
onMounted(loadRefInfo)
</script>

<style scoped>
.ref-link-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  margin-bottom: 12px;
}

.ref-link-text {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-all;
  font-family: var(--font-mono);
}

.copy-btn {
  font-size: 18px;
  background: none;
  padding: 4px;
  transition: transform 0.2s;
}
.copy-btn:active { transform: scale(0.9); }

.copied-tip {
  text-align: center;
  color: var(--accent-green);
  font-size: 13px;
  margin-top: 8px;
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

.share-btns {
  display: flex;
  gap: 10px;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.rule-num {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--gradient-fire);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
