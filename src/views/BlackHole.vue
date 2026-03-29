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
        <div class="stat-value">{{ globalStats.totalBNB }}</div>
        <div class="stat-label">总投入BNB</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ globalStats.participants }}</div>
        <div class="stat-label">参与人数</div>
      </div>
    </div>

    <!-- 通道切换 -->
    <div class="tab-switch">
      <button
        class="tab-item"
        :class="{ active: activeChannel === 'bnb' }"
        @click="activeChannel = 'bnb'"
      >BNB通道</button>
      <button
        class="tab-item"
        :class="{ active: activeChannel === 'token' }"
        @click="activeChannel = 'token'"
      >代币通道</button>
    </div>

    <!-- 参与卡片 -->
    <div class="glass-card" style="margin-bottom: 16px;">
      <div class="section-title">
        <span class="icon">🌀</span>
        <span>打入黑洞</span>
        <span style="margin-left: auto; font-size: 12px; color: var(--text-secondary);">
          {{ activeChannel === 'bnb' ? '0.1 - 10 BNB' : '10万 - 100万枚' }}
        </span>
      </div>

      <!-- BNB 通道 -->
      <div v-if="activeChannel === 'bnb'">
        <div class="input-group">
          <input
            v-model="bnbAmount"
            type="number"
            step="0.1"
            min="0.1"
            max="10"
            placeholder="输入BNB数量"
          />
          <span class="unit">BNB</span>
        </div>
        <div class="quick-btns">
          <button v-for="v in [0.1, 0.5, 1, 5, 10]" :key="v" class="quick-btn" @click="bnbAmount = v">{{ v }}</button>
        </div>
      </div>

      <!-- 代币通道 -->
      <div v-else>
        <div class="input-group">
          <input
            v-model="tokenAmount"
            type="number"
            step="100000"
            placeholder="输入代币数量"
          />
          <span class="unit">枚</span>
        </div>
        <div class="quick-btns">
          <button v-for="v in [100000, 200000, 500000, 1000000]" :key="v" class="quick-btn" @click="tokenAmount = v">
            {{ v >= 10000 ? (v / 10000) + '万' : v }}
          </button>
        </div>
      </div>

      <div class="split-info">
        <span>20%销毁</span><span>50%分红</span><span>25%推广</span><span>5%排行榜</span>
      </div>

      <button class="btn-primary" @click="handleParticipate" :disabled="loading">
        <span v-if="loading" class="loading-spin"></span>
        <span v-else>🌀 打入黑洞</span>
      </button>
    </div>

    <!-- 我的黑洞数据 -->
    <div class="glass-card">
      <div class="section-title">
        <span class="icon">📋</span>
        <span>我的{{ activeChannel === 'bnb' ? 'BNB' : '代币' }}通道</span>
      </div>

      <div class="data-row">
        <span class="label">投入权重</span>
        <span class="value">{{ channelInfo.weight }}</span>
      </div>
      <div class="data-row">
        <span class="label">2倍出局上限</span>
        <span class="value highlight">{{ channelInfo.totalReward }}</span>
      </div>
      <div class="data-row">
        <span class="label">已领分红</span>
        <span class="value">{{ channelInfo.withdrawn }}</span>
      </div>
      <div class="data-row">
        <span class="label">推广奖计入</span>
        <span class="value">{{ channelInfo.refCredited }}</span>
      </div>
      <div class="data-row">
        <span class="label">排行榜奖计入</span>
        <span class="value">{{ channelInfo.lbCredited }}</span>
      </div>
      <div class="data-row">
        <span class="label">待领取</span>
        <span class="value highlight" style="font-size: 16px;">{{ channelInfo.pending }}</span>
      </div>
      <div v-if="channelInfo.poolInsufficient" class="pool-warning">
        奖池余额不足，理论应得 {{ channelInfo.pendingRaw }}，当前可领 {{ channelInfo.pending }}
      </div>

      <!-- 出局进度条 -->
      <div class="progress-bar-wrap">
        <div class="progress-label">
          <span>出局进度</span>
          <span>{{ channelInfo.progressPct }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: channelInfo.progressPct + '%' }"></div>
        </div>
      </div>

      <button class="btn-secondary" @click="handleClaim" :disabled="claimLoading" style="margin-top: 14px;">
        <span v-if="claimLoading" class="loading-spin"></span>
        <span v-else>领取分红</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { Contract, parseEther, parseUnits } from 'ethers'
import BlackHoleVortex from '../components/BlackHoleVortex.vue'
import { DAPP_ADDRESS, DAPP_ABI, TOKEN_ADDRESS, TOKEN_ABI } from '../utils/contracts.js'
import { fmtBNB, fmtToken, getRefFromURL } from '../utils/helpers.js'

const props = defineProps(['wallet', 'provider', 'signer'])

const activeChannel = ref('bnb')
const bnbAmount = ref('')
const tokenAmount = ref('')
const loading = ref(false)
const claimLoading = ref(false)

const globalStats = reactive({
  totalBurned: '--',
  totalBNB: '--',
  participants: '--',
})

const channelInfo = reactive({
  weight: '--',
  totalReward: '--',
  withdrawn: '--',
  refCredited: '--',
  lbCredited: '--',
  pending: '--',
  pendingRaw: '--',       // 理论应得（原始值）
  poolInsufficient: false, // 奖池是否不足
  progressPct: 0,
})

// 加载全局数据
async function loadGlobalStats() {
  if (!props.provider) return
  try {
    const dapp = new Contract(DAPP_ADDRESS, DAPP_ABI, props.provider)
    const [burned, bnbInvested, pBNB, pToken] = await Promise.all([
      dapp.totalTokenBurned(),
      dapp.totalBNBInvested(),
      dapp.totalParticipantsBNB(),
      dapp.totalParticipantsToken(),
    ])
    globalStats.totalBurned = fmtToken(burned)
    globalStats.totalBNB = fmtBNB(bnbInvested)
    globalStats.participants = (Number(pBNB) + Number(pToken)).toString()
  } catch (e) {
    console.error('loadGlobalStats:', e)
  }
}

// 加载用户通道数据
async function loadChannelInfo() {
  if (!props.provider || !props.wallet) return
  try {
    const dapp = new Contract(DAPP_ADDRESS, DAPP_ABI, props.provider)
    const isBNB = activeChannel.value === 'bnb'
    const fn = isBNB ? 'getUserBNBInfo' : 'getUserTokenInfo'
    const info = await dapp[fn](props.wallet)
    const fmt = isBNB ? fmtBNB : (v) => fmtToken(v)

    channelInfo.weight = fmt(info.weight)
    channelInfo.totalReward = fmt(info.totalReward)
    channelInfo.withdrawn = fmt(info.withdrawn)
    channelInfo.refCredited = fmt(info.refCredited)
    channelInfo.lbCredited = fmt(info.lbCredited)

    // 用2倍出局上限约束pending（合约可能返回溢出值）
    const totalClaimed = BigInt(info.withdrawn) + BigInt(info.refCredited) + BigInt(info.lbCredited)
    const totalTarget = BigInt(info.totalReward)
    const maxRemaining = totalTarget > totalClaimed ? totalTarget - totalClaimed : 0n
    const pendingRaw = BigInt(info.pending) > maxRemaining ? maxRemaining : BigInt(info.pending)

    // 获取奖池实际余额，显示真实可领取金额
    let poolBalance
    if (isBNB) {
      poolBalance = await props.provider.getBalance(DAPP_ADDRESS)
    } else {
      const tokenContract = new Contract(TOKEN_ADDRESS, TOKEN_ABI, props.provider)
      poolBalance = await tokenContract.balanceOf(DAPP_ADDRESS)
    }
    const actualClaimable = pendingRaw < poolBalance ? pendingRaw : poolBalance
    channelInfo.pending = fmt(actualClaimable)
    channelInfo.pendingRaw = fmt(pendingRaw)
    channelInfo.poolInsufficient = pendingRaw > 0n && pendingRaw > poolBalance

    channelInfo.progressPct = totalTarget > 0n
      ? Math.min(100, Number((totalClaimed * 100n) / totalTarget))
      : 0
  } catch (e) {
    console.error('loadChannelInfo:', e)
  }
}

// 打入黑洞
async function handleParticipate() {
  if (!props.signer) return alert('请先连接钱包')
  loading.value = true
  try {
    const dapp = new Contract(DAPP_ADDRESS, DAPP_ABI, props.signer)
    const refAddr = getRefFromURL()

    if (activeChannel.value === 'bnb') {
      const val = parseEther(String(bnbAmount.value || '0'))
      const tx = await dapp.participateBNB(refAddr, { value: val })
      await tx.wait()
    } else {
      // 先approve
      const tokenContract = new Contract(TOKEN_ADDRESS, TOKEN_ABI, props.signer)
      const amt = parseUnits(String(tokenAmount.value || '0'), 18)
      const allowance = await tokenContract.allowance(props.wallet, DAPP_ADDRESS)
      if (allowance < amt) {
        const appTx = await tokenContract.approve(DAPP_ADDRESS, amt)
        await appTx.wait()
      }
      const tx = await dapp.participateToken(refAddr, amt)
      await tx.wait()
    }
    bnbAmount.value = ''
    tokenAmount.value = ''
    await loadChannelInfo()
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

    // 领取前检查：用2倍出局上限约束pending（合约可能返回溢出值）
    const isBNB = activeChannel.value === 'bnb'
    const infoFn = isBNB ? 'getUserBNBInfo' : 'getUserTokenInfo'
    const claimInfo = await dapp[infoFn](props.wallet)
    const claimedSum = BigInt(claimInfo.withdrawn) + BigInt(claimInfo.refCredited) + BigInt(claimInfo.lbCredited)
    const cap = BigInt(claimInfo.totalReward)
    const maxPending = cap > claimedSum ? cap - claimedSum : 0n
    const rawPending = BigInt(claimInfo.pending)
    const realPending = rawPending > maxPending ? maxPending : rawPending

    if (realPending === 0n) {
      alert('当前无可领取分红')
      claimLoading.value = false
      return
    }

    // 检查合约余额是否足够
    let contractBalance
    if (isBNB) {
      contractBalance = await props.signer.provider.getBalance(DAPP_ADDRESS)
    } else {
      const tokenContract = new Contract(TOKEN_ADDRESS, TOKEN_ABI, props.signer.provider)
      contractBalance = await tokenContract.balanceOf(DAPP_ADDRESS)
    }
    if (contractBalance < realPending) {
      alert(isBNB ? '当前合约BNB余额不足，请稍后再试，避免资金损失' : '当前合约代币余额不足，请稍后再试')
      claimLoading.value = false
      return
    }

    const fn = activeChannel.value === 'bnb' ? 'claimBNBDividend' : 'claimTokenDividend'
    const tx = await dapp[fn]()
    await tx.wait()
    await loadChannelInfo()
  } catch (e) {
    console.error('claim error:', e)
    alert('领取失败: ' + (e?.reason || e?.message || '未知错误'))
  } finally {
    claimLoading.value = false
  }
}

watch(() => props.wallet, () => { loadGlobalStats(); loadChannelInfo() })
watch(activeChannel, () => loadChannelInfo())
onMounted(() => { loadGlobalStats(); loadChannelInfo() })
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
  margin-top: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #ff9800;
  background: rgba(255, 152, 0, 0.1);
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: var(--radius-sm);
  line-height: 1.4;
}
</style>
