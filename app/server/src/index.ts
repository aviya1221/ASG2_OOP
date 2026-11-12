import { createClient } from "@supabase/supabase-js";
import { AttendanceRoutes } from "./attendance/AttendanceRoutes.ts";
import { AttendanceRules } from "./attendance/AttendanceRules.ts";
import { AttendanceService } from "./attendance/AttendanceService.ts";
import { ClassFaceCache } from "./attendance/ClassFaceCache.ts";
import { FaceMatcher } from "./attendance/FaceMatcher.ts";
import { loadConfig, loadServerConfig } from "./config/env.ts";
import { createServices } from "./container.ts";
import { GuideGenerator } from "./homework/GuideGenerator.ts";
import { HomeworkRoutes } from "./homework/HomeworkRoutes.ts";
import { HomeworkService } from "./homework/HomeworkService.ts";
import { SolutionReviewer } from "./homework/SolutionReviewer.ts";
import { createApp } from "./http/app.ts";
import { SupabaseAttendanceRepository } from "./integrations/supabase/SupabaseAttendanceRepository.ts";
import { SupabaseHomeworkRepository } from "./integrations/supabase/SupabaseHomeworkRepository.ts";
import { SupabaseNotificationRepository } from "./integrations/supabase/SupabaseNotificationRepository.ts";
import { SupabaseSummaryRepository } from "./integrations/supabase/SupabaseSummaryRepository.ts";
import { SupabaseUserVerifier } from "./integrations/supabase/SupabaseUserVerifier.ts";
import { SilentSender, WebPushSender } from "./integrations/webpush/WebPushSender.ts";
import { NotificationService } from "./notifications/NotificationService.ts";
import { FfmpegSoundExtractor } from "./summaries/SoundExtractor.ts";
import { SummaryGenerator } from "./summaries/SummaryGenerator.ts";
import { SummaryRoutes } from "./summaries/SummaryRoutes.ts";
import { SummaryService } from "./summaries/SummaryService.ts";

const config = loadServerConfig();
const { llm, reviewLlm } = createServices(loadConfig());
const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const verifier = new SupabaseUserVerifier(supabase);
const notifications = new NotificationService(
  new SupabaseNotificationRepository(supabase),
  config.vapid ? new WebPushSender(config.vapid) : new SilentSender(),
);
const attendance = new AttendanceService({
  repository: new SupabaseAttendanceRepository(supabase),
  cache: new ClassFaceCache(),
  matcher: new FaceMatcher(),
  rules: new AttendanceRules(),
  notifications,
});
const summaries = new SummaryService(new SupabaseSummaryRepository(supabase), new SummaryGenerator(llm, new FfmpegSoundExtractor()));
const homework = new HomeworkService(new SupabaseHomeworkRepository(supabase), new GuideGenerator(llm), new SolutionReviewer(reviewLlm));

const app = createApp({
  webOrigins: config.webOrigins,
  verifier,
  routers: [
    new AttendanceRoutes(attendance, notifications, verifier).router(),
    new SummaryRoutes(summaries, verifier).router(),
    new HomeworkRoutes(homework, verifier).router(),
  ],
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Server listening on port ${config.port}`);
});

// Shared class photos are deleted 24 hours after sharing. The free server sleeps, so this also runs when it wakes.
const PHOTO_SWEEP_MS = 10 * 60_000;
function removeExpiredPhotos(): void {
  attendance.removeExpiredPhotos().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Deleting expired class photos failed");
  });
}
removeExpiredPhotos();
setInterval(removeExpiredPhotos, PHOTO_SWEEP_MS);
