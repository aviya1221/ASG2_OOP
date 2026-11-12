# F1 Attendance: approach and decisions

What the team agreed about attendance.
Agreed on 2026-11-12, after a test on a real class photo. It replaces the earlier design, which recognised each student's face ([ADR-1](../02-tools-report.md)), and the request steps that came with it: row and seat, and later a number in the photo for students who were not recognised. This note feeds the attendance requirements in the SRS (F1), UC-01, the SDD, EDD-Attendance, the STD and the tools report.

## 1. The idea

Each student confirms by themselves that they are in the lesson. One photo of the class checks that the number of confirmations makes sense. Only when there are more confirmations than faces in the photo does each student who confirmed point to their own face.

## 2. Why we dropped face recognition

We ran the whole earlier flow on a real photo of a lecture hall: 2000 × 1500 pixels, with 41 faces. Nine students were registered.

- **The comparison failed:**
  - One student was marked present on another person's face.
  - A second student was matched to a stranger.
  - A student who was seated in the hall was missed.
- **No threshold could fix it.** Right matches scored 0.35 to 0.43, and wrong matches scored up to 0.40.
- **Finding faces worked well.** The face finder found 41 faces in one shot of a large hall.

So we keep only the finding of faces, and use it to count them.

## 3. What we agreed

1. **One photo.** The teacher takes one photo of the class during the lesson. The teacher's phone counts the faces and sends the server only the number. The photo stays on the teacher's phone. Without face recognition we cannot tell that one person appears in two photos, so a second photo would count people twice.
2. **Four minutes to confirm.** From the moment of the photo, and for 4 minutes, every student of the course gets a notification and sees an "I was in the lesson" button. One tap sends the confirmation. After 4 minutes the button disappears.
3. **The check.** When the 4 minutes end, the system compares the number of confirmations with the number of faces:
   - Equal, or fewer confirmations: every student who confirmed is present.
   - More confirmations than faces: someone confirmed without being in the hall, so every student who confirmed must point to their own face. See step 4.
4. **Picking a number:**
   1. The teacher shares the photo with a number on every face.
   2. Every student who confirmed gets a notification and picks their number.
   3. A number that only one student picked makes that student present, with no approval from the teacher.
   4. When two students pick the same number, both see "passed to the teacher for further handling", and the teacher decides.
   5. A student who confirmed and does not pick a number within 24 hours of the sharing is not present.
5. **No confirmation, no attendance.** A student who did not press the button is not present.
6. **The teacher has the last word.** The teacher can change the attendance of any student in their lessons at any time, even without a photo: present, not present, or back to the automatic result.

## 4. Further details

1. **A number on every face.** The numbers run from left to right.
2. **"I am not in the photo."** The face finder misses very small faces. A student who cannot find their face can say so, and the teacher decides.
3. **A pick can still reach the teacher later.** If another student picks the same number afterwards, both picks go to the teacher.
4. **One approval rejects the other.** When the teacher approves one of two students on the same number, the other is rejected.
5. **No photo, no button.** If the teacher did not take a photo, no student can confirm. A student who arrives after the 4 minutes cannot confirm either. In both cases the teacher can mark attendance by hand.
6. **One of each.** A student cannot take back a confirmation. A lesson has one photo, and the teacher cannot take it again.
7. **The notifications:**
   - When the teacher takes the photo: "The teacher photographed the class. If you are in the lesson, you have 4 minutes to press 'I was in the lesson'."
   - When the teacher shares the photo, only to students who confirmed: "There were more confirmations than people in the photo. Pick your number in the class photo."
8. **Flag.** The sheet flags a student only when one of their picks was rejected.
9. **Who sees the shared photo.**
   - The photo waits on the teacher's phone, and only that phone can share it.
   - Once shared, the teacher and the students who confirmed in that lesson can see it.
   - The server deletes it after 24 hours.
10. **The sheet.** It says how each result was decided: the student's confirmation, a number in the photo, or the teacher's decision. A change by the teacher is never flagged.

## 5. What we keep and what we remove

- **We keep:**
  - finding faces in the teacher's browser (YuNet through OpenCV.js);
  - keeping the photo on the teacher's phone;
  - drawing the numbers;
  - sharing the photo for 24 hours;
  - picking a number;
  - the live attendance sheet and its download.
- **We remove:**
  - the face registration selfie;
  - the face-print model (SFace with ONNX Runtime Web, about 54 MB less to download);
  - the comparison on the server;
  - the tables that held face data.

## 6. Still open

- Number the faces row by row, from the front row backwards, instead of from left to right.
