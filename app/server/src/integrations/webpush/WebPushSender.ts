import { sendNotification } from "web-push";
import type { PushSender, PushSubscriptionData } from "../../notifications/NotificationService.ts";

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** The only file that knows the Web Push library. */
export class WebPushSender implements PushSender {
  readonly #keys: VapidKeys;

  constructor(keys: VapidKeys) {
    this.#keys = keys;
  }

  async send(subscription: PushSubscriptionData, message: string): Promise<number> {
    try {
      const response = await sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        message,
        { vapidDetails: this.#keys },
      );
      return response.statusCode;
    } catch (error) {
      const status = (error as { statusCode?: unknown }).statusCode;
      if (typeof status === "number") return status;
      throw error;
    }
  }
}

/** Used when no keys are set, for example in tests and local runs. */
export class SilentSender implements PushSender {
  async send(): Promise<number> {
    return 201;
  }
}
