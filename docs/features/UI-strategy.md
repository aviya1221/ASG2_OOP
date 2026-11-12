# User interface: approach and decisions

What the team agreed about the look and the screens of the product, before writing the design documents.
Agreed on 2026-11-09 and updated on 2026-11-11 and 2026-11-12 after walk-throughs of the working product, and again on 2026-11-12 for attendance by confirmation ([F1 decisions](F1-attendance-strategy.md)). This note feeds the SRS, the SDD and the tools report.

## 1. The idea

All the screens share one calm look: black bands for titles and navigation, and a light area for reading. The product is in Hebrew, from right to left, and teachers and students use it on a phone.

## 2. What we agreed

### The look

1. **Style.** Near-black and light-gray areas, a few muted colors, rounded corners and large bold headings. Buttons are soft and rounded, with no black frame.
2. **No faces.** No smiley or face drawings anywhere in the product.
3. **Top bar.** One black bar runs across the full width of every screen. On one side it has a back arrow and the product name, which leads to the first screen. On the other side it shows the name and role of the signed-in user, and sign-out. Below it, each page has its own band with its title spread across the width. On a lesson page the band holds the course name, the lecture and the three tabs, and the open tab takes the color of the content below it.
4. **Content.** Content sits on light gray.
5. **Main action.** The main action of a screen is a filled black button.
6. **Attendance results.** Each result has a color and always shows its word: present is green, waiting is yellow, not present is orange, confirmed is blue, and "not confirmed yet" and "no photo" are gray.

### The screens

7. **Entry.** One sign-in for everyone, and then a first screen by role.
8. **Admin.** Works on a computer, on one screen with the weekly timetable and a form for a new course.
9. **Teacher and student.** Work on a phone. The first screen is a weekly timetable of their lessons. Above it, a card leads in one tap to the lesson happening now, or to the next one. On a computer the whole week shows, Sunday to Friday. On a phone one day shows at a time, under a strip of the days, and it opens on today. Sign-out sits in the top bar.
10. **Lesson page.** One page with three tabs: attendance, forum and homework. The tabs sit in the middle of the page's band, and each tab reacts when the pointer rests on it. The open tab already says where the user is, so the content below it starts with no main title. Inner headings that separate parts of a tab stay.
11. **Attendance, teacher.** A large button to photograph the class. After the photo, the same place shows the time left to confirm and how many students confirmed. When the time ends it shows the confirmations against the faces, and when needed the photo with numbers to share. Below it come the picks that wait for the teacher, and the attendance sheet with a download button, where the teacher can change any result.
12. **Attendance, student.** For 4 minutes after the teacher's photo, an "I was in the lesson" button, and then the student's result. When more students confirmed than there are faces, the student picks their number in the shared photo, or says they are not in it. The button that turns on notifications sits here too.
13. **Forum.** Messages and replies, polls, forms and the button to the lesson summary. A list of all the lectures is one button away.
14. **Expanded conversation.** An expand button opens the lesson conversation in a large window. On a phone the window fills the screen, the user can write in it, and a poll appears in it as one line.
15. **Homework.** The homework with a button to check a solution before submitting, the student's own report and the class chart with its filter.

### Building it

16. **Client tool.** React with Vite, written in TypeScript like the server.

### Added after the walk-through (2026-11-11)

17. **Icons.** Common actions show a thin-line icon instead of a word: expand (two arrows), close, delete (a bin), reply, edit, back and sign-out. Main actions, such as sending or publishing, show an icon and a short word. Every icon keeps its word as a hint and for screen readers, and no icon shows a face.
18. **Long actions keep running.** Publishing a homework, checking a solution, uploading a recording and processing the class photo go on when the user moves to another page of the product. While it runs, the page where it started says in words what is happening and about how long it takes. No loading sign moves on the screen. A short message says when it has ended. Closing or reloading the page during an upload asks the user first, because only that stops it.
