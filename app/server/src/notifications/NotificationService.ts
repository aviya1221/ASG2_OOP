export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface NotificationRepository {
  saveSubscription(studentId: string, subscription: PushSubscriptionData): Promise<void>;
  subscriptionsOfLesson(lessonId: string): Promise<PushSubscriptionData[]>;
  subscriptionsOfStudents(studentIds: string[]): Promise<PushSubscriptionData[]>;
  deleteSubscription(endpoint: string): Promise<void>;
}

/** Sends one message, and answers with the status code of the browser's notification service. */
export interface PushSender {
  send(subscription: PushSubscriptionData, message: string): Promise<number>;
}

const GONE = new Set([404, 410]);
const ROUND_MESSAGE = JSON.stringify({ title: "נוכחות", body: "הכיתה צולמה. פתיחת האתר תסמן את הנוכחות." });
const PHOTO_MESSAGE = JSON.stringify({ title: "נוכחות", body: "לא זוהית בתמונת הכיתה. אפשר לבחור את המספר שלך בתמונה." });

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

  /** Notifies every student of the course of this lesson that the class was photographed. */
  async notifyCourse(lessonId: string): Promise<void> {
    await this.#sendAll(await this.#repository.subscriptionsOfLesson(lessonId), ROUND_MESSAGE);
  }

  /** Tells these students that the class photo with numbers is waiting for them. */
  async notifyPhotoShared(studentIds: string[]): Promise<void> {
    if (studentIds.length === 0) return;
    await this.#sendAll(await this.#repository.subscriptionsOfStudents(studentIds), PHOTO_MESSAGE);
  }

  /** Sends to each subscription, and forgets subscriptions that no longer exist. */
  async #sendAll(subscriptions: PushSubscriptionData[], message: string): Promise<void> {
    await Promise.all(
      subscriptions.map(async (subscription) => {
        const status = await this.#sender.send(subscription, message);
        if (GONE.has(status)) await this.#repository.deleteSubscription(subscription.endpoint);
      }),
    );
  }
}
