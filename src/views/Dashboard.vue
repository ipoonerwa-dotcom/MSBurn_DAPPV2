<template>
  <div class="page">
    <div class="section-title" style="margin-top: 10px;">
      <span class="icon">📊</span>
      <span>数据看板</span>
    </div>

    <!-- 全局统计 -->
    <div class="glass-card" style="margin-bottom: 16px;">
      <div class="section-title">
        <span class="icon">🌐</span>
        <span>全局数据</span>
      </div>

      <div class="stats-grid two-col">
        <div class="stat-item">
          <div class="stat-value">{{ stats.totalBurned }}</div>
          <div class="stat-label">总销毁代币</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.totalTokenInvested }}</div>
          <div class="stat-label">代币总投入</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.totalParticipants }}</div>
          <div class="stat-label">参与人数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.totalExited }}</div>
          <div class="stat-label">已出局人数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.stakingRewardPool }}</div>
          <div class="stat-label">质押奖池</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.totalStaked }}</div>
          <div class="stat-label">质押总量</div>
        </div>
      </div>
    </div>

    <!-- 排行榜 -->
    <div class="glass-card">
      <div class="section-title">
        <span class="icon">🏆</span>
        <span>排行榜（本期）</span>
      </div>

      <!-- 奖池与倒计时 -->
      <div class="lb-pool-info">
        <div class="lb-pool">
          <span class="lb-pool-label">🏆 奖池</span>
          <span class="lb-pool-value gradient-text">{{ lbInfo.pool }} 枚</span>
        </div>
        <div class="lb-pool">
          <span class="lb-pool-label">⏰ 开榜倒计时</span>
          <span class="lb-pool-value">{{ lbInfo.countdown }}</span>
        </div>
      </div>

      <!-- 排名列表 -->
      <div class="lb-list">
        <div
          v-for="(item, idx) in leaderboardList"
          :key="idx"
          class="lb-item"
          :class="{ 'top-3': idx < 3 }"
        >
          <div class="lb-rank">
            <span v-if="idx === 0" class="medal">🥇</span>
            <span v-else-if="idx === 1" class="medal">🥈</span>
            <span v-else-if="idx === 2" class="medal">🥉</span>
            <span v-else class="rank-num">{{ idx + 1 }}</span>
          </div>
          <div class="lb-addr">{{ item.addr }}</div>
          <div class="lb-amount gradient-text">{{ item.amount }}</div>
        </div>

        <div v-if="leaderboardList.length === 0" class="empty-state">
          <p>暂无数据</p>
        </div>
      </div>

      <!-- 分配比例说明 -->
      <div class="lb-shares-info">
        <span>🥇20%</span>
        <span>🥈15%</span>
        <span>🥉10%</span>
        <span>4-10名均分55%</span>
      </div>

      <div class="lb-note">
        每12小时开榜，开榜后排名清零重新计算
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import { Contract } from 'ethers'
import { DAPP_ADDRESS, DAPP_ABI, STAKING_ADDRESS, STAKING_ABI } from '../utils/contracts.js'
import { fmtToken, shortAddr, formatCountdown } from '../utils/helpers.js'

const props = defineProps(['wallet', 'provider', 'signer'])

let timer = null

const stats = reactive({
  totalBurned: '--',
  totalTokenInvested: '--',
  totalParticipants: '--',
  totalExited: '--',
  stakingRewardPool: '--',
  totalStaked: '--',
})

const lbInfo = reactive({
  pool: '--',
  countdown: '--',
})

const leaderboardList = ref([])

async function loadStats() {
  if (!props.provider) return
  try {
    const dapp = new Contract(DAPP_ADDRESS, DAPP_ABI, props.provider)
    const staking = new Contract(STAKING_ADDRESS, STAKING_ABI, props.provider)

    const [burned, tokenInv, participants, exited, poolInfo] = await Promise.all([
      dapp.totalTokenBurned(),
      dapp.totalTokenInvested(),
      dapp.totalParticipants(),
      dapp.totalExited(),
      staking.getPoolInfo(),
    ])

    stats.totalBurned = fmtToken(burned) + ' 枚'
    stats.totalTokenInvested = fmtToken(tokenInv) + ' 枚'
    stats.totalParticipants = Number(participants).toString()
    stats.totalExited = Number(exited).toString()
    stats.stakingRewardPool = fmtToken(poolInfo._rewardPool) + ' 枚'
    stats.totalStaked = fmtToken(poolInfo._totalStaked) + ' 枚'
  } catch (e) {
    console.error('loadStats:', e)
  }
}

async function loadLeaderboard() {
  if (!props.provider) return
  try {
    const dapp = new Contract(DAPP_ADDRESS, DAPP_ABI, props.provider)

    const [lb, lbPool] = await Promise.all([
      dapp.getLeaderboard(),
      dapp.getLeaderboardPoolInfo(),
    ])

    leaderboardList.value = lb.addrs
      .map((addr, i) => ({
        addr: shortAddr(addr),
        amount: fmtToken(lb.amounts[i]) + ' 枚',
        raw: lb.amounts[i],
      }))
      .filter(item => item.raw > 0n)

    lbInfo.pool = fmtToken(lbPool.pool)

    const now = Math.floor(Date.now() / 1000)
    const remain = Number(lbPool.nextDistributeTime) - now
    lbInfo.countdown = remain > 0 ? formatCountdown(remain) : '可开榜'
  } catch (e) {
    console.error('loadLeaderboard:', e)
  }
}

onMounted(() => {
  loadStats()
  loadLeaderboard()
  timer = setInterval(() => {
    loadStats()
    loadLeaderboard()
  }, 15000)
})

onUnmounted(() => { if (timer) clearInterval(timer) })

watch(() => props.wallet, () => { loadStats(); loadLeaderboard() })
</script>

<style scoped>
.two-col {
  grid-template-columns: repeat(2, 1fr);
}

.lb-pool-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.lb-pool {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lb-pool-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.lb-pool-value {
  font-size: 16px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.lb-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.lb-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.lb-item.top-3 {
  border-color: rgba(255, 215, 0, 0.2);
  background: rgba(255, 215, 0, 0.03);
}

.lb-rank {
  width: 32px;
  text-align: center;
  flex-shrink: 0;
}

.medal { font-size: 20px; }

.rank-num {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-secondary);
}

.lb-addr {
  flex: 1;
  font-size: 13px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.lb-amount {
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.lb-shares-info {
  display: flex;
  justify-content: space-around;
  font-size: 11px;
  color: var(--text-dim);
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
}

.lb-note {
  text-align: center;
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 10px;
}

.empty-state {
  text-align: center;
  padding: 30px 0;
  color: var(--text-dim);
  font-size: 14px;
}
</style>
