// ============================================================
//  v2 合约地址与ABI配置
//  部署后替换地址即可
// ============================================================

// BSC Mainnet
export const CHAIN_ID = 56
export const CHAIN_CONFIG = {
  chainId: '0x38',
  chainName: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com/'],
}

// ==================== 合约地址（部署后替换） ====================
export const TOKEN_ADDRESS = '0x7410b419a069fCD9968bb5644ba9c311ADF181cB'
export const DAPP_ADDRESS = '0x652984DE95c5b7652378629871a66221AAB3EbAc'
export const STAKING_ADDRESS = '0xfbA899C1aB3B6ccFbB7723c021850Ce6C1C4E4D7'

// ==================== Token ABI ====================
export const TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
]

// ==================== BlackHoleDApp ABI (v2) ====================
export const DAPP_ABI = [
  // 参与
  'function participate(address _ref, uint256 tokenAmount)',
  // 领取
  'function claimDividend()',
  // 查询 - 用户
  'function getUserInfo(address user) view returns (uint256 weight, uint256 totalReward, uint256 withdrawn, uint256 refCredited, uint256 lbCredited, uint256 pending, bool active)',
  'function getUserRefInfo(address user) view returns (address ref, uint256 l1, uint256 l2, uint256 refTotal, bool active)',
  'function getLeaderboard() view returns (address[10] addrs, uint256[10] amounts)',
  'function getLeaderboardPoolInfo() view returns (uint256 pool, uint256 nextDistributeTime)',
  'function getPoolStats() view returns (uint256 _reservePool, uint256 _leaderboardPool, uint256 _totalActiveWeight, uint256 _totalDividendAdded, uint256 _contractBalance)',
  // 全局
  'function totalParticipants() view returns (uint256)',
  'function totalExited() view returns (uint256)',
  'function totalTokenInvested() view returns (uint256)',
  'function totalTokenBurned() view returns (uint256)',
  'function totalActiveWeight() view returns (uint256)',
  'function referrer(address) view returns (address)',
  // 参数
  'function minToken() view returns (uint256)',
  'function maxToken() view returns (uint256)',
  'function tokenUnit() view returns (uint256)',
]

// ==================== StakingPool ABI (v2) ====================
export const STAKING_ABI = [
  // 操作
  'function stake(uint256 tokenAmount, uint256 tierId)',
  'function unstake(uint256 stakeId)',
  'function depositReward(uint256 amount)',
  // 查询
  'function getUserStakeCount(address user) view returns (uint256)',
  'function getUserStakeInfo(address user, uint256 stakeId) view returns (uint256 amount, uint256 tierId, uint256 startTime, uint256 endTime, uint256 reward, bool claimed, bool canUnstake)',
  'function getPoolInfo() view returns (uint256 _rewardPool, uint256 _reservedReward, uint256 _totalStaked, uint256 _totalRewardPaid)',
  'function getTierCount() view returns (uint256)',
  'function tiers(uint256) view returns (uint256 duration, uint256 rewardRate, bool enabled)',
  'function hasActiveStake(address) view returns (bool)',
  'function totalStaked() view returns (uint256)',
  'function rewardPool() view returns (uint256)',
]
