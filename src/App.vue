<template>
  <div class="app-shell">
    <!-- 星空背景 -->
    <StarsBg />

    <!-- 顶部导航栏 -->
    <header class="top-bar">
      <div class="logo-area" @click="$router.push('/blackhole')">
        <span class="logo-icon">🐴</span>
        <span class="logo-text gradient-text">马上燃烧</span>
      </div>
      <button class="wallet-btn" @click="walletConnected ? disconnectWallet() : connectWallet()">
        <span class="wallet-dot" :class="{ connected: walletConnected }"></span>
        {{ walletDisplay }}
      </button>
    </header>

    <!-- 页面内容 -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" :wallet="walletAddress" :provider="provider" :signer="signer" />
        </transition>
      </router-view>
    </main>

    <!-- 底部Tab栏 -->
    <nav class="bottom-nav">
      <router-link
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="nav-item"
        :class="{ active: $route.path === tab.path }"
      >
        <span class="nav-icon">{{ tab.icon }}</span>
        <span class="nav-label">{{ tab.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted } from 'vue'
import { BrowserProvider, JsonRpcProvider } from 'ethers'
import StarsBg from './components/StarsBg.vue'
import { getRefFromURL } from './utils/helpers.js'

const walletAddress = ref('')
const walletConnected = ref(false)
const provider = shallowRef(null)
const signer = shallowRef(null)

// 启动时立刻捕获ref参数并缓存，防止后续导航丢失
onMounted(() => {
  getRefFromURL()
  if (!provider.value) {
    provider.value = new JsonRpcProvider('https://bsc-dataseed.binance.org/')
  }
})

const tabs = [
  { path: '/blackhole', icon: '🌀', label: '黑洞' },
  { path: '/staking', icon: '⛏', label: '质押' },
  { path: '/referral', icon: '👥', label: '推广' },
  { path: '/dashboard', icon: '📊', label: '数据' },
]

const walletDisplay = computed(() => {
  if (!walletAddress.value) return '链接钱包'
  const addr = walletAddress.value
  return addr.slice(0, 6) + '...' + addr.slice(-4)
})

function disconnectWallet() {
  walletAddress.value = ''
  walletConnected.value = false
  signer.value = null
  provider.value = new JsonRpcProvider('https://bsc-dataseed.binance.org/')
}

async function connectWallet() {
  if (!window.ethereum) {
    alert('请安装MetaMask或其他Web3钱包')
    return
  }
  try {
    const p = new BrowserProvider(window.ethereum)
    await p.send('eth_requestAccounts', [])
    const s = await p.getSigner()
    const addr = await s.getAddress()
    provider.value = p
    signer.value = s
    walletAddress.value = addr
    walletConnected.value = true

    // 监听账户切换
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        walletAddress.value = ''
        walletConnected.value = false
        provider.value = null
        signer.value = null
      } else {
        walletAddress.value = accounts[0]
      }
    })
  } catch (e) {
    console.error('连接钱包失败:', e)
  }
}
</script>

<style scoped>
.app-shell {
  max-width: 450px;
  margin: 0 auto;
  min-height: 100vh;
  position: relative;
}

/* 顶部栏 */
.top-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(10, 10, 26, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color);
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 1px;
}

.wallet-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  transition: all 0.3s;
}

.wallet-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: var(--accent-orange);
}

.wallet-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-dim);
  transition: background 0.3s;
}

.wallet-dot.connected {
  background: var(--accent-green);
  box-shadow: 0 0 8px var(--accent-green);
}

/* 主内容 */
.main-content {
  position: relative;
  z-index: 1;
}

/* 底部导航 */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 450px;
  display: flex;
  background: rgba(10, 10, 26, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--border-color);
  padding: 6px 0;
  padding-bottom: max(6px, env(safe-area-inset-bottom));
  z-index: 100;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 0;
  text-decoration: none;
  transition: all 0.2s;
}

.nav-icon {
  font-size: 22px;
  transition: transform 0.2s;
}

.nav-label {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
  transition: color 0.2s;
}

.nav-item.active .nav-label {
  color: var(--accent-gold);
  font-weight: 700;
}

.nav-item.active .nav-icon {
  transform: scale(1.15);
}
</style>
