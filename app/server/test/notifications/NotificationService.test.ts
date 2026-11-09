import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NotificationService, type NotificationRepository, type PushSubscriptionData } from "../../src/notifications/NotificationService.ts";

const COURSE_A: PushSubscriptionData[] = [
  { endpoint: "https://push/s1", p256dh: "k1", auth: "a1" },
  { endpoint: "https://push/s2", p256dh: "k2", auth: "a2" },
  { endpoint: "https://push/gone", p256dh: "k3", auth: "a3" },
];

describe("NotificationService", () => {
  it("TC-016 sends once to each subscription of the course, and removes one that no longer exists", async () => {
    const sent: string[] = [];
    const deleted: string[] = [];
    const repository: NotificationRepository = {
      saveSubscription: async () => {},
      subscriptionsOfLesson: async (lessonId) => (lessonId === "L1" ? COURSE_A : [{ endpoint: "https://push/s51", p256dh: "k", auth: "a" }]),
      deleteSubscription: async (endpoint) => {
        deleted.push(endpoint);
      },
    };
    const service = new NotificationService(repository, {
      send: async (subscription) => {
        sent.push(subscription.endpoint);
        return subscription.endpoint.endsWith("gone") ? 410 : 201;
      },
    });

    await service.notifyCourse("L1");

    assert.deepEqual(sent.sort(), ["https://push/gone", "https://push/s1", "https://push/s2"]);
    assert.deepEqual(deleted, ["https://push/gone"]);
  });

  it("saves a subscription under the student", async () => {
    const saved: [string, PushSubscriptionData][] = [];
    const service = new NotificationService(
      {
        saveSubscription: async (student, subscription) => {
          saved.push([student, subscription]);
        },
        subscriptionsOfLesson: async () => [],
        deleteSubscription: async () => {},
      },
      { send: async () => 201 },
    );
    await service.subscribe("S1", COURSE_A[0]!);
    assert.deepEqual(saved, [["S1", COURSE_A[0]]]);
  });
});
