import { Platform } from "react-native"
import {
  endConnection,
  finishTransaction,
  getAvailablePurchases,
  getSubscriptions,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestSubscription,
  type ProductPurchase,
  type Purchase,
  type Subscription,
  type SubscriptionPurchase,
} from "react-native-iap"
import { COLLECTOOLS_BASE_URL } from "../config"
import { ALL_APPLE_PRODUCT_IDS, appleProductIdFromPriceKey, isIapPriceKey } from "./config"

let connectionReady = false
let listenersAttached = false

type PendingPurchase = {
  priceKey: string
  resolve: (purchase: Purchase) => void
  reject: (error: Error) => void
}

let pendingPurchase: PendingPurchase | null = null

export type IapResult =
  | { ok: true; plan?: string; productId?: string }
  | { ok: false; error: string; canceled?: boolean }

function purchaseTransactionId(purchase: Purchase): string | null {
  const ios = purchase as ProductPurchase
  return (
    purchase.transactionId ||
    ios.transactionIdIOS ||
    purchase.purchaseToken ||
    null
  )
}

function purchaseOriginalTransactionId(purchase: Purchase): string | null {
  const ios = purchase as ProductPurchase
  return ios.originalTransactionIdentifierIOS || purchase.transactionId || null
}

export function buildVerifyPurchaseInject(purchase: Purchase, priceKey?: string): string {
  const transactionId = purchaseTransactionId(purchase)
  const productId = purchase.productId
  const originalTransactionId = purchaseOriginalTransactionId(purchase)
  const payload = JSON.stringify({
    transactionId,
    productId,
    originalTransactionId,
    priceKey: priceKey ?? null,
  })

  return `
(function(){
  try {
    fetch(${JSON.stringify(`${COLLECTOOLS_BASE_URL}/api/billing/apple/verify`)}, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: ${JSON.stringify(payload)},
    }).then(function(res){
      return res.json().then(function(data){
        window.dispatchEvent(new CustomEvent("collectools-iap-complete", { detail: data }));
        return data;
      });
    }).catch(function(err){
      window.dispatchEvent(new CustomEvent("collectools-iap-complete", {
        detail: { ok: false, error: String(err && err.message ? err.message : err) }
      }));
    });
  } catch (e) {
    window.dispatchEvent(new CustomEvent("collectools-iap-complete", {
      detail: { ok: false, error: String(e && e.message ? e.message : e) }
    }));
  }
})();
true;
`
}

export function buildRestorePurchasesInject(purchases: Purchase[]): string {
  const body = JSON.stringify({
    purchases: purchases
      .map((purchase) => ({
        transactionId: purchaseTransactionId(purchase),
        productId: purchase.productId,
        originalTransactionId: purchaseOriginalTransactionId(purchase),
      }))
      .filter((row) => Boolean(row.transactionId)),
  })

  return `
(function(){
  try {
    fetch(${JSON.stringify(`${COLLECTOOLS_BASE_URL}/api/billing/apple/restore`)}, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: ${JSON.stringify(body)},
    }).then(function(res){
      return res.json().then(function(data){
        window.dispatchEvent(new CustomEvent("collectools-iap-complete", { detail: data }));
        return data;
      });
    }).catch(function(err){
      window.dispatchEvent(new CustomEvent("collectools-iap-complete", {
        detail: { ok: false, error: String(err && err.message ? err.message : err) }
      }));
    });
  } catch (e) {
    window.dispatchEvent(new CustomEvent("collectools-iap-complete", {
      detail: { ok: false, error: String(e && e.message ? e.message : e) }
    }));
  }
})();
true;
`
}

function attachPurchaseListeners() {
  if (listenersAttached) return
  listenersAttached = true

  purchaseUpdatedListener(async (purchase: Purchase | SubscriptionPurchase) => {
    try {
      await finishTransaction({ purchase, isConsumable: false })
    } catch {
      // ignore finish errors; server verification is source of truth
    }

    if (pendingPurchase) {
      pendingPurchase.resolve(purchase)
      pendingPurchase = null
    }
  })

  purchaseErrorListener((error) => {
    if (!pendingPurchase) return
    const canceled = error.code === "E_USER_CANCELLED"
    pendingPurchase.reject(
      new Error(canceled ? "Purchase canceled" : error.message || "Purchase failed"),
    )
    pendingPurchase = null
  })
}

export async function ensureIapConnection(): Promise<void> {
  if (Platform.OS !== "ios") return
  if (connectionReady) return
  await initConnection()
  attachPurchaseListeners()
  await getSubscriptions({ skus: ALL_APPLE_PRODUCT_IDS })
  connectionReady = true
}

export async function purchaseSubscription(priceKey: string): Promise<{
  purchase: Purchase
  verifyInject: string
}> {
  if (Platform.OS !== "ios") {
    throw new Error("In-App Purchase is only available on iOS.")
  }
  if (!isIapPriceKey(priceKey)) {
    throw new Error("Unknown subscription plan.")
  }

  await ensureIapConnection()
  const sku = appleProductIdFromPriceKey(priceKey)
  if (!sku) throw new Error("Unknown subscription plan.")

  const subs = (await getSubscriptions({ skus: [sku] })) as Subscription[]
  if (!subs.length) {
    throw new Error(
      "This subscription is not available yet. Create the product in App Store Connect and try again on TestFlight.",
    )
  }

  const purchasePromise = new Promise<Purchase>((resolve, reject) => {
    pendingPurchase = { priceKey, resolve, reject }
  })

  await requestSubscription({ sku })
  const purchase = await purchasePromise
  return {
    purchase,
    verifyInject: buildVerifyPurchaseInject(purchase, priceKey),
  }
}

export async function restorePurchases(): Promise<{ verifyInject: string; count: number }> {
  if (Platform.OS !== "ios") {
    throw new Error("Restore purchases is only available on iOS.")
  }

  await ensureIapConnection()
  const purchases = await getAvailablePurchases()
  const relevant = purchases.filter((purchase) =>
    ALL_APPLE_PRODUCT_IDS.includes(purchase.productId),
  )

  if (relevant.length === 0) {
    throw new Error("No CollecTools subscriptions found for this Apple ID.")
  }

  for (const purchase of relevant) {
    try {
      await finishTransaction({ purchase, isConsumable: false })
    } catch {
      // ignore
    }
  }

  return {
    verifyInject: buildRestorePurchasesInject(relevant),
    count: relevant.length,
  }
}

export async function teardownIapConnection(): Promise<void> {
  if (!connectionReady) return
  try {
    await endConnection()
  } catch {
    // ignore
  }
  connectionReady = false
}
