export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface NotificationRepository {
  saveSubscription(studentId: string, subscription: PushSubscriptionData): Promise<void>;
  subscriptionsOfLesson(lessonId: string): Promise<PushSubscriptionData[]>;
  deleteSubscription(endpoint: string): Promise<void>;
}

/** Sends one message, and answers with the status code of the browser's notification service. */
export interface PushSender {
  send(subscription: PushSubscriptionData, message: string): Promise<number>;
}

const GONE = new Set([404, 410]);
const MESSAGE = JSON.stringify({ title: "נוכחות", body: "הכיתה צולמה. פתיחת האתר תסמן את הנוכחות." });

export class NotificationService {
  readonly #repository: NotificationRepository;
  readonly #sender: PushSender;

  constructor(repository: NotificationRepository, sender: PushSender) {
    this.#repository = repository;
    this.#sender = sender;
  }

  async subscribe(studentId: string, subscription: PushSubscriptionData): Promise<void> {
    await this.#repository.saveSubscription(studentId, subscription);
  }

  /** Notifies every student of the course of this lesson, and forgets subscriptions that no longer exist. */
  async notifyCourse(lessonId: string): Promise<void> {
    const subscriptions = await this.#repository.subscriptionsOfLesson(lessonId);
    await Promise.all(
      subscriptions.map(async (subscription) => {
        const status = await this.#sender.send(subscription, MESSAGE);
        if (GONE.has(status)) await this.#repository.deleteSubscription(subscription.endpoint);
      }),
    );
  }
}
