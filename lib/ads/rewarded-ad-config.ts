/** Google Ad Manager rewarded ad unit path for web (GPT OutOfPageFormat.REWARDED). */
export function getRewardedAdUnitPath(): string | null {
  const path = process.env.NEXT_PUBLIC_GAM_REWARDED_AD_UNIT?.trim()
  return path || null
}

export function isRewardedAdConfigured(): boolean {
  return Boolean(getRewardedAdUnitPath())
}
