<template>
  <div class="page">
    <!-- 黑洞动画 -->
    <BlackHoleVortex />

    <!-- 全局统计 -->
    <div class="stats-grid" style="margin-bottom: 20px;">
      <div class="stat-item">
        <div class="stat-value">{{ globalStats.totalBurned }}</div>
        <div class="stat-label">总销毁</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ globalStats.totalInvested }}</div>
        <div class="stat-label">总投入</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ globalStats.participants }}</div>
        <div class="stat-label">参与人数</div>
      </div>
    </div>

    <!-- 参与卡片 -->
    <div class="glass-card" style="margin-bottom: 16px;">
      <div class="section-title">
        <span class="icon">🌀</span>
        <span>打入黑洞</span>
        <span style="margin-left: auto; font-size: 12px; color: var(--text-secondary);">
          10万 - 20万枚
        </span>
      </div>

      <div class="input-group">
        <input
          v-model="tokenAmount"
          type="number"
          step="10000"
          placeholder="输入代币数量"
        />
        <span class="unit">枚</span>
      </div>
      <div class="quick-btns">
        <button v-for="v in [100000, 120000, 150000, 200000]" :key="v" class="quick-btn" @click="tokenAmount = v">
          {{ v / 10000 }}万
        </button>
      </div>

      <div class="split-info">
        <span>20%销毁</span><span>35%分红</span><span>15%沉淀</span><span>25%推广</span><span>5%排行榜</span>
      </div>

      <div v-if="userInfo.active" class="pool-warning">
        当前已在参与中，出局后方可再次参与
      </div>

      <button class="btn-primary" @click="handleParticipate" :disabled="loading || userInfo.active">
        <span v-if="loading" class="loading-spin"></span>
        <span v-else>🌀 打入黑洞</span>
      </button>
    </div>

    <!-- 我的黑洞数据 -->
    <div class="glass-card">
      <div class="section-title">
        <span class="icon">📋</span>
        <span>我的数据</span>
      </div>

      <div class="data-row">
        <span class="label">状态</span>
        <span class="value" :style="{ color: userInfo.active ? 'var(--accent-green)' : 'var(--text-dim)' }">
          {{ userInfo.active ? '参与中' : '未参与' }}
        </span>
      </div>
      <div class="data-row">
        <span class="label">投入权重</span>
        <span class="value">{{ userInfo.weight }} 枚</span>
      </div>
      <div class="data-row">
        <span class="label">2倍出局上限</span>
        <span class="value highlight">{{ userInfo.totalReward }} 枚</span>
      </div>
      <div class="data-row">
        <span class="label">已领分红</span>
        <span class="value">{{ userInfo.withdrawn }} 枚</span>
      </div>
      <div class="data-row">
        <span class="label">推广奖计入</span>
        <span class="value">{{ userInfo.refCredited }} 枚</span>
      </div>
      <div class="data-row">
        <span class="label">排行榜奖计入</span>
        <span class="value">{{ userInfo.lbCredited }} 枚</span>
      </div>
      <div class="data-row">
        <span class="label">待领取</span>
        <span class="value highlight" style="font-size: 16px;">{{ userInfo.pending }} 枚</span>
      </div>

      <!-- 出局进度条 -->
      <div class="progress-bar-wrap">
        <div class="progress-label">
          <span>出局进度</span>
          <span>{{ userInfo.progressPct }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: userInfo.progressPct + '%' }"></div>
        </div>
      </div>

      <button class="btn-secondary" @click="handleClaim" :disabled="claimLoading || !userInfo.active || userInfo.pending === '0'" style="margin-top: 14px;">
        <span v-if="claimLoading" class="loading-spin"></span>
        <span v-else>领取分红</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { Contract, parseUnits } from 'ethers'
import BlackHoleVortex from '../components/BlackHoleVortex.vue'
import { DAPP_ADDRESS, DAPP_ABI, TOKEN_ADDRESS, TOKEN_ABI } from '../utils/contracts.js'
import { fmtToken, getRefFromURL } from '../utils/helpers.js'

const props = defineProps(['wallet', 'provider', 'signer'])

const tokenAmount = ref('')
const loading = ref(false)
const claimLoading = ref(false)

const globalStats = reactive({
  totalBurned: '--',
  totalInvested: '--',
  participants: '--',
})

const userInfo = reactive({
  weight: '--',
  totalReward: '--',
  withdrawn: '--',
  refCredited: '--',
  lbCredited: '--',
  pending: '--',
  active: false,
  progressPct: 0,
})

// 加载全局数据
async function loadGlobalStats() {
  if (!props.provider) return
  try {
    const dapp = new Contract(DAPP_ADDRESS, DAPP_ABI, props.provider)
    const [burned, invested, participants] = await Promise.all([
      dapp.totalTokenBurned(),
      dapp.totalTokenInvested(),
      dapp.totalParticipants(),
    ])
    globalStats.totalBurned = fmtToken(burned) + ' 枚'
    globalStats.totalInvested = fmtToken(invested) + ' 枚'
    globalStats.participants = Number(participants).toString()
  } catch (e) {
    console.error('loadGlobalStats:', e)
  }
}

// 加载用户数据
async function loadUserInfo() {
  if (!props.provider || !props.wallet) return
  try {
    const dapp = new Contract(DAPP_ADDRESS, DAPP_ABI, props.provider)
    const info = await dapp.getUserInfo(props.wallet)

    userInfo.weight = fmtToken(info.weight)
    userInfo.totalReward = fmtToken(info.totalReward)
    userInfo.withdrawn = fmtToken(info.withdrawn)
    userInfo.refCredited = fmtToken(info.refCredited)
    userInfo.lbCredited = fmtToken(info.lbCredited)
    userInfo.active = info.active

    const totalClaimed = BigInt(info.withdrawn) + BigInt(info.refCredited) + BigInt(info.lbCredited)
    const totalTarget = BigInt(info.totalReward)

    userInfo.pending = fmtToken(info.pending)

    userInfo.progressPct = totalTarget > 0n
      ? Math.min(100, Number((totalClaimed * 100n) / totalTarget))
      : 0
  } catch (e) {
    console.error('loadUserInfo:', e)
  }
}

// 打入黑洞
async function handleParticipate() {
  if (!props.signer) return alert('请先连接钱包')
  if (userInfo.active) return alert('当前已在参与中，出局后方可再次参与')
  loading.value = true
  try {
    const dapp = new Contract(DAPP_ADDRESS, DAPP_ABI, props.signer)
    const tokenContract = new Contract(TOKEN_ADDRESS, TOKEN_ABI, props.signer)
    const refAddr = getRefFromURL()
    const amt = parseUnits(String(tokenAmount.value || '0'), 18)

    // approve
    const allowance = await tokenContract.allowance(props.wallet, DAPP_ADDRESS)
    if (allowance < amt) {
      const appTx = await tokenContract.approve(DAPP_ADDRESS, amt)
      await appTx.wait()
    }

    const tx = await dapp.participate(refAddr, amt)
    await tx.wait()
    tokenAmount.value = ''
    await loadUserInfo()
    await loadGlobalStats()
  } catch (e) {
    console.error('participate error:', e)
    alert('操作失败: ' + (e?.reason || e?.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

// 领取分红
async function handleClaim() {
  if (!props.signer) return alert('请先连接钱包')
  claimLoading.value = true
  try {
    const dapp = new Contract(DAPP_ADDRESS, DAPP_ABI, props.signer)
    const tx = await dapp.claimDividend()
    await tx.wait()
    await loadUserInfo()
  } catch (e) {
    console.error('claim error:', e)
    const reason = e?.reason || e?.message || '未知错误'
    if (reason.includes('nothing')) {
      alert('当前无可领取分红')
    } else if (reason.includes('pool insufficient')) {
      alert('当前奖池未累计足够奖励，请稍后再试')
    } else {
      alert('领取失败: ' + reason)
    }
  } finally {
    claimLoading.value = false
  }
}

watch(() => props.wallet, () => { loadGlobalStats(); loadUserInfo() })
onMounted(() => { loadGlobalStats(); loadUserInfo() })
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
  background: rgba(255, 107, 53, 0.1);
}

.split-info {
  display: flex;
  justify-content: space-around;
  margin-bottom: 14px;
  padding: 8px 0;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
}

.split-info span {
  font-size: 11px;
  color: var(--text-dim);
}

/* 进度条 */
.progress-bar-wrap {
  margin-top: 14px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--gradient-fire);
  border-radius: 3px;
  transition: width 0.6s ease;
}

.pool-warning {
  margin-bottom: 12px;
  padding: 8px 12px;
  font-size: 12px;
  color: #ff9800;
  background: rgba(255, 152, 0, 0.1);
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: var(--radius-sm);
  line-height: 1.4;
}
</style>
