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
        <div class="stat-label">奖池BNB</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ poolInfo.totalStaked }}</div>
        <div class="stat-label">总质押</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ poolInfo.nextSettle }}</div>
        <div class="stat-label">下次结算</div>
      </div>
    </div>

    <!-- 质押操作 -->
    <div class="glass-card" style="margin-bottom: 16px;">
      <div class="section-title">
        <span class="icon">📥</span>
        <span>质押代币</span>
        <span style="margin-left: auto; font-size: 12px; color: var(--text-secondary);">
          10万 - 100万枚
        </span>
      </div>

      <div class="input-group">
        <input
          v-model="stakeAmount"
          type="number"
          step="100000"
          placeholder="输入质押数量"
        />
        <span class="unit">枚</span>
      </div>

      <div class="quick-btns">
        <button v-for="v in [100000, 200000, 500000, 1000000]" :key="v"
          class="quick-btn" @click="stakeAmount = v">
          {{ v / 10000 }}万
        </button>
      </div>

      <div class="stake-info-row">
        <span>🔒 锁仓时间</span>
        <span class="gradient-text" style="font-weight: 700;">5天</span>
      </div>
      <div class="stake-info-row">
        <span>💰 分红来源</span>
        <span>盈利税BNB，每24h结算50%</span>
      </div>

      <div v-if="hasActiveStake" class="pool-warning" style="margin-top: 12px;">
        当前已有质押，到期领取后方可再次质押
      </div>
      <button class="btn-primary" @click="handleStake" :disabled="stakeLoading || hasActiveStake" style="margin-top: 12px;">
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
            <span class="label">累计收益</span>
            <span class="value highlight">{{ s.rewardDisplay }} BNB</span>
          </div>
        </div>
        <button
          v-if="s.canUnstake"
          class="btn-secondary"
          @click="handleUnstake(idx)"
          :disabled="unstakeLoading === idx"
        >
          <span v-if="unstakeLoading === idx" class="loading-spin"></span>
          <span v-else>🎁 领取本金+收益</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { Contract, parseUnits } from 'ethers'
import { STAKING_ADDRESS, STAKING_ABI, TOKEN_ADDRESS, TOKEN_ABI } from '../utils/contracts.js'
import { fmtBNB, fmtToken, formatCountdown } from '../utils/helpers.js'

const props = defineProps(['wallet', 'provider', 'signer'])

const stakeAmount = ref('')
const stakeLoading = ref(false)
const unstakeLoading = ref(-1)
const stakes = ref([])
let timer = null

// 是否有未完成的质押（锁仓中或可领取但未领取）
const hasActiveStake = computed(() => {
  return stakes.value.some(s => !s.claimed)
})

const poolInfo = reactive({
  rewardPool: '--',
  totalStaked: '--',
  nextSettle: '--',
})

async function loadPoolInfo() {
  if (!props.provider) return
  try {
    const staking = new Contract(STAKING_ADDRESS, STAKING_ABI, props.provider)
    const info = await staking.getPoolInfo()
    poolInfo.rewardPool = fmtBNB(info.pool)
    poolInfo.totalStaked = fmtToken(info.staked)
    const now = Math.floor(Date.now() / 1000)
    const remain = Number(info.nextSettle) - now
    poolInfo.nextSettle = remain > 0 ? formatCountdown(remain) : '可结算'
  } catch (e) {
    console.error('loadPoolInfo:', e)
  }
}

async function loadStakes() {
  if (!props.provider || !props.wallet) return
  try {
    const staking = new Contract(STAKING_ADDRESS, STAKING_ABI, props.provider)
    const count = await staking.getUserStakeCount(props.wallet)
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

      list.push({
        amountDisplay: fmtToken(info.amount),
        rewardDisplay: fmtBNB(info.reward),
        canUnstake: info.canUnstake,
        claimed,
        statusText,
        statusClass,
        timeDisplay,
      })
    }
    stakes.value = list
  } catch (e) {
    console.error('loadStakes:', e)
  }
}

async function handleStake() {
  if (!props.signer) return alert('请先连接钱包')
  if (hasActiveStake.value) return alert('当前已有质押，到期领取后方可再次质押')
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
    const tx = await staking.stake(amt)
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

// 定时刷新倒计时
onMounted(() => {
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

.stake-info-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
  padding: 6px 0;
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
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.stake-id {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
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
.pool-warning {
  padding: 8px 12px;
  font-size: 12px;
  color: #ff9800;
  background: rgba(255, 152, 0, 0.1);
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: var(--radius-sm);
  line-height: 1.4;
}

.stake-detail .value.highlight {
  background: var(--gradient-fire);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>
