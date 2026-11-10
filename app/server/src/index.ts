import { createClient } from "@supabase/supabase-js";
import { AttendanceRoutes } from "./attendance/AttendanceRoutes.ts";
import { AttendanceRules } from "./attendance/AttendanceRules.ts";
import { AttendanceService } from "./attendance/AttendanceService.ts";
import { ClassFaceCache } from "./attendance/ClassFaceCache.ts";
import { FaceMatcher } from "./attendance/FaceMatcher.ts";
import { loadConfig, loadServerConfig } from "./config/env.ts";
import { createServices } from "./container.ts";
import { createApp } from "./http/app.ts";
import { SupabaseAttendanceRepository } from "./integrations/supabase/SupabaseAttendanceRepository.ts";
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
const { llm } = createServices(loadConfig());
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

const app = createApp({
  webOrigins: config.webOrigins,
  verifier,
  routers: [new AttendanceRoutes(attendance, notifications, verifier).router(), new SummaryRoutes(summaries, verifier).router()],
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Server listening on port ${config.port}`);
});
