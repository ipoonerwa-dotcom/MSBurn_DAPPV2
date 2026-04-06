<template>
  <div class="page">
    <div class="section-title" style="margin-top: 10px;">
      <span class="icon">⛏</span>
      <span>质押挖矿</span>
    </div>

    <!-- 质押池概况 -->
    <div class="stats-grid" style="margin-bottom: 20px;">
      <div class="stat-item">
        <div class="stat-value">{{ poolInfo.rewardPool }}</div>
        <div class="stat-label">奖池余额</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ poolInfo.totalStaked }}</div>
        <div class="stat-label">总质押</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ poolInfo.totalPaid }}</div>
        <div class="stat-label">累计发放</div>
      </div>
    </div>

    <!-- 质押操作 -->
    <div class="glass-card" style="margin-bottom: 16px;">
      <div class="section-title">
        <span class="icon">📥</span>
        <span>质押代币</span>
        <span style="margin-left: auto; font-size: 12px; color: var(--text-secondary);">
          10万 - 50万枚
        </span>
      </div>

      <div class="input-group">
        <input
          v-model="stakeAmount"
          type="number"
          step="10000"
          placeholder="输入质押数量"
        />
        <span class="unit">枚</span>
      </div>

      <div class="quick-btns">
        <button v-for="v in [100000, 200000, 300000, 500000]" :key="v"
          class="quick-btn" @click="stakeAmount = v">
          {{ v / 10000 }}万
        </button>
      </div>

      <!-- 档位选择 -->
      <div class="tier-selector">
        <div
          v-for="(t, idx) in tierList"
          :key="idx"
          class="tier-card"
          :class="{ active: selectedTier === idx, disabled: !t.enabled }"
          @click="t.enabled && (selectedTier = idx)"
        >
          <div class="tier-duration">{{ t.durationText }}</div>
          <div class="tier-rate gradient-text">{{ t.rateText }}</div>
          <div class="tier-reward" v-if="stakeAmount > 0">
            ≈{{ formatReward(idx) }}枚
          </div>
        </div>
      </div>

      <div class="stake-info-row">
        <span>💰 奖励方式</span>
        <span>质押获取代币奖励</span>
      </div>

      <div v-if="hasActive" class="pool-warning" style="margin-top: 12px;">
        当前已有质押，到期领取后方可再次质押
      </div>
      <button class="btn-primary" @click="handleStake" :disabled="stakeLoading || hasActive" style="margin-top: 12px;">
        <span v-if="stakeLoading" class="loading-spin"></span>
        <span v-else>⛏ 质押</span>
      </button>
    </div>

    <!-- 我的质押列表 -->
    <div class="glass-card">
      <div class="section-title">
        <span class="icon">📋</span>
        <span>我的质押</span>
        <span style="margin-left: auto; font-size: 12px; color: var(--text-secondary);">
          共 {{ stakes.length }} 笔
        </span>
      </div>

      <div v-if="stakes.length === 0" class="empty-state">
        <p>暂无质押记录</p>
      </div>

      <div v-for="(s, idx) in stakes" :key="idx" class="stake-card">
        <div class="stake-header">
          <span class="stake-id">#{{ idx + 1 }}</span>
          <span class="stake-tier">{{ s.tierText }}</span>
          <span class="stake-status" :class="s.statusClass">{{ s.statusText }}</span>
        </div>
        <div class="stake-body">
          <div class="stake-detail">
            <span class="label">质押量</span>
            <span class="value">{{ s.amountDisplay }} 枚</span>
          </div>
          <div class="stake-detail">
            <span class="label">{{ s.claimed ? '已结束' : '剩余时间' }}</span>
            <span class="value">{{ s.timeDisplay }}</span>
          </div>
          <div class="stake-detail">
            <span class="label">预计奖励</span>
            <span class="value highlight">{{ s.rewardDisplay }} 枚</span>
          </div>
        </div>
        <button
          v-if="s.canUnstake"
          class="btn-secondary"
          @click="handleUnstake(idx)"
          :disabled="unstakeLoading === idx"
        >
          <span v-if="unstakeLoading === idx" class="loading-spin"></span>
          <span v-else>🎁 领取本金+奖励</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import { Contract, parseUnits } from 'ethers'
import { STAKING_ADDRESS, STAKING_ABI, TOKEN_ADDRESS, TOKEN_ABI } from '../utils/contracts.js'
import { fmtToken, formatCountdown } from '../utils/helpers.js'

const props = defineProps(['wallet', 'provider', 'signer'])

const stakeAmount = ref('')
const selectedTier = ref(0)
const stakeLoading = ref(false)
const unstakeLoading = ref(-1)
const stakes = ref([])
const hasActive = ref(false)
const tierList = ref([])
let timer = null

const poolInfo = reactive({
  rewardPool: '--',
  totalStaked: '--',
  totalPaid: '--',
})

const tierDurationText = (seconds) => {
  const days = Math.floor(seconds / 86400)
  if (days > 0) return days + '天'
  const hours = Math.floor(seconds / 3600)
  return hours + '小时'
}

function formatReward(tierIdx) {
  const t = tierList.value[tierIdx]
  if (!t || !stakeAmount.value) return '0'
  const reward = Math.floor(Number(stakeAmount.value) * t.rewardRate / 10000)
  return reward.toLocaleString()
}

async function loadTiers() {
  if (!props.provider) return
  try {
    const staking = new Contract(STAKING_ADDRESS, STAKING_ABI, props.provider)
    const count = await staking.getTierCount()
    const list = []
    for (let i = 0; i < Number(count); i++) {
      const t = await staking.tiers(i)
      list.push({
        duration: Number(t.duration),
        rewardRate: Number(t.rewardRate),
        enabled: t.enabled,
        durationText: tierDurationText(Number(t.duration)),
        rateText: (Number(t.rewardRate) / 100).toFixed(0) + '%',
      })
    }
    tierList.value = list
  } catch (e) {
    console.error('loadTiers:', e)
  }
}

async function loadPoolInfo() {
  if (!props.provider) return
  try {
    const staking = new Contract(STAKING_ADDRESS, STAKING_ABI, props.provider)
    const info = await staking.getPoolInfo()
    poolInfo.rewardPool = fmtToken(info._rewardPool) + ' 枚'
    poolInfo.totalStaked = fmtToken(info._totalStaked) + ' 枚'
    poolInfo.totalPaid = fmtToken(info._totalRewardPaid) + ' 枚'
  } catch (e) {
    console.error('loadPoolInfo:', e)
  }
}

async function loadStakes() {
  if (!props.provider || !props.wallet) return
  try {
    const staking = new Contract(STAKING_ADDRESS, STAKING_ABI, props.provider)
    const count = await staking.getUserStakeCount(props.wallet)
    hasActive.value = await staking.hasActiveStake(props.wallet)

    const list = []
    const now = Math.floor(Date.now() / 1000)

    for (let i = 0; i < Number(count); i++) {
      const info = await staking.getUserStakeInfo(props.wallet, i)
      const endTime = Number(info.endTime)
      const remain = endTime - now
      const claimed = info.claimed

      let statusText, statusClass, timeDisplay
      if (claimed) {
        statusText = '已完成'; statusClass = 'done'
        timeDisplay = '--'
      } else if (remain <= 0) {
        statusText = '可领取'; statusClass = 'ready'
        timeDisplay = '已到期'
      } else {
        statusText = '锁仓中'; statusClass = 'locked'
        timeDisplay = formatCountdown(remain)
      }

      const tier = tierList.value[Number(info.tierId)]
      const tierText = tier ? tier.durationText + ' / ' + tier.rateText : '--'

      list.push({
        amountDisplay: fmtToken(info.amount),
        rewardDisplay: fmtToken(info.reward),
        canUnstake: info.canUnstake,
        claimed,
        statusText,
        statusClass,
        timeDisplay,
        tierText,
      })
    }
    stakes.value = list
  } catch (e) {
    console.error('loadStakes:', e)
  }
}

async function handleStake() {
  if (!props.signer) return alert('请先连接钱包')
  if (hasActive.value) return alert('当前已有质押，到期领取后方可再次质押')
  stakeLoading.value = true
  try {
    const amt = parseUnits(String(stakeAmount.value || '0'), 18)
    // approve
    const tokenContract = new Contract(TOKEN_ADDRESS, TOKEN_ABI, props.signer)
    const allowance = await tokenContract.allowance(props.wallet, STAKING_ADDRESS)
    if (allowance < amt) {
      const appTx = await tokenContract.approve(STAKING_ADDRESS, amt)
      await appTx.wait()
    }
    const staking = new Contract(STAKING_ADDRESS, STAKING_ABI, props.signer)
    const tx = await staking.stake(amt, selectedTier.value)
    await tx.wait()
    stakeAmount.value = ''
    await loadStakes()
    await loadPoolInfo()
  } catch (e) {
    console.error('stake error:', e)
    alert('质押失败: ' + (e?.reason || e?.message || '未知错误'))
  } finally {
    stakeLoading.value = false
  }
}

async function handleUnstake(stakeId) {
  if (!props.signer) return alert('请先连接钱包')
  unstakeLoading.value = stakeId
  try {
    const staking = new Contract(STAKING_ADDRESS, STAKING_ABI, props.signer)
    const tx = await staking.unstake(stakeId)
    await tx.wait()
    await loadStakes()
    await loadPoolInfo()
  } catch (e) {
    console.error('unstake error:', e)
    alert('领取失败: ' + (e?.reason || e?.message || '未知错误'))
  } finally {
    unstakeLoading.value = -1
  }
}

onMounted(async () => {
  await loadTiers()
  loadPoolInfo()
  loadStakes()
  timer = setInterval(() => {
    loadPoolInfo()
    loadStakes()
  }, 15000)
})

onUnmounted(() => { if (timer) clearInterval(timer) })

watch(() => props.wallet, () => { loadPoolInfo(); loadStakes() })
</script>

<style scoped>
.quick-btns {
  display: flex;
  gap: 8px;
  margin: 10px 0 14px;
}
.quick-btn {
  flex: 1;
  padding: 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}
.quick-btn:hover {
  color: var(--accent-gold);
  border-color: var(--accent-orange);
}

/* 档位选择 */
.tier-selector {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.tier-card {
  flex: 1;
  text-align: center;
  padding: 12px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.2s;
}
.tier-card.active {
  border-color: var(--accent-orange);
  background: rgba(255, 107, 53, 0.1);
}
.tier-card.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tier-duration {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.tier-rate {
  font-size: 18px;
  font-weight: 700;
}
.tier-reward {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 4px;
}

.stake-info-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
  padding: 6px 0;
}

.pool-warning {
  padding: 8px 12px;
  font-size: 12px;
  color: #ff9800;
  background: rgba(255, 152, 0, 0.1);
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: var(--radius-sm);
  line-height: 1.4;
}

.empty-state {
  text-align: center;
  padding: 30px 0;
  color: var(--text-dim);
  font-size: 14px;
}

/* 质押卡片 */
.stake-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 14px;
  margin-bottom: 10px;
}

.stake-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.stake-id {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
}

.stake-tier {
  font-size: 12px;
  color: var(--text-dim);
  flex: 1;
}

.stake-status {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 10px;
}
.stake-status.locked {
  background: rgba(255, 107, 53, 0.15);
  color: var(--accent-orange);
}
.stake-status.ready {
  background: rgba(118, 255, 3, 0.15);
  color: var(--accent-green);
}
.stake-status.done {
  background: rgba(139, 139, 163, 0.15);
  color: var(--text-secondary);
}

.stake-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.stake-detail {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.stake-detail .label { color: var(--text-secondary); }
.stake-detail .value { color: var(--text-primary); font-weight: 600; font-family: var(--font-mono); }
.stake-detail .value.highlight {
  background: var(--gradient-fire);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>
