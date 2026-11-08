# F2 Lesson forum: approach and decisions

What the team agreed about comments and suggestions, before writing their documents.
Agreed on 2026-11-08. This note feeds the comments and polls requirements in the SRS (F2, F3), their use cases and their EDDs.

## 1. The idea

Every date of a lesson has its own forum: one running conversation, in the spirit of a Telegram channel. Students comment and raise suggestions during the lesson and after it, and teachers publish polls and forms in the same place.

## 2. What we agreed

### The forum

1. **One forum tab.** It replaces separate comments and polls tabs in the lesson.
2. **One forum per lesson date.** Each new date of a lesson gets a new forum for that day, and its conversation is saved.
3. **Who reads it.** Everyone linked to the lesson.
4. **Who writes.** Everyone linked to the lesson can open a new message and reply to a message.
5. **Names.** For each message, the student chooses whether the class sees their name. The teacher always sees who wrote it.
6. **Always open.** The forum of every date stays open for writing, with no closing rule. Forums are listed by date.
7. **Messages are text only** and may contain links.
8. **No editing.** Only the teacher can delete a message.

### Polls and forms

9. **Quick poll.** The teacher publishes it in the forum during the lesson. Everyone linked to the lesson sees the results, and the teacher also sees who answered what.
10. **Form.** A more complex survey with several questions, which the teacher builds inside the app and publishes in the forum.
    - Its questions can be single choice, multiple choice, a rating on a scale, or free text.
    - It opens in a window over the forum, so students answer without leaving it.
    - Only the teacher sees the results, including who answered what.
11. **Closing.** The teacher chooses when to close a quick poll or a form. A quick poll that is still open closes at the end of the lesson.
12. **One answer per student.** A student cannot answer again unless the teacher allowed it when creating the poll or form.
13. **Form builder code.** We reuse existing code if the tools report finds something suitable, and otherwise write it ourselves.

## 3. What this changes in existing documents

- [F3 polls strategy](F3-polls-strategy.md) describes a separate polls tab and one question per poll. The tab is replaced by the forum, and forms are added. The reused pieces for quick polls still apply.
- The polls requirements in the SRS (REQ-30 to REQ-38) were written for that separate tab.
- Both say that a second answer replaces the first. Decision 12 replaces that rule.

## 4. Still open

- When the teacher allows another answer, whether it replaces the student's earlier answer or is added to it.
