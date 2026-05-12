# 04 Data Model

## Prisma draft

```prisma
model User {
  id                  String   @id @default(cuid())
  spotifyUserId       String   @unique
  displayName         String?
  spotifyRefreshToken String
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  musicProfile        MusicProfile?
  sessions            ListeningSession[]
  feedback            TrackFeedback[]
}

model MusicProfile {
  id              String   @id @default(cuid())
  userId          String   @unique
  tasteSummary    String   @default("")
  avoidSummary    String   @default("")
  classicalLevel  String   @default("beginner")
  jazzLevel       String   @default("beginner")
  situationRules  Json?
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id])
}

model ListeningSession {
  id             String   @id @default(cuid())
  userId         String
  mode           String
  userPrompt     String
  aiPlanJson     Json
  createdAt      DateTime @default(now())

  user           User     @relation(fields: [userId], references: [id])
}

model TrackFeedback {
  id             String   @id @default(cuid())
  userId         String
  spotifyTrackId String
  feedbackType   String
  context        String?
  createdAt      DateTime @default(now())

  user           User     @relation(fields: [userId], references: [id])
}

model MusicNote {
  id                 String   @id @default(cuid())
  type               String
  title              String
  artistOrComposer   String
  style              String
  difficulty         String
  introShort         String
  listeningPoints    Json
  spotifySearchQuery String
  tags               String[]
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

## Seed notes for MVP
- Bach — Cello Suite No.1 Prelude
- Dvořák — Cello Concerto
- Debussy — Clair de Lune
- Bill Evans — Waltz for Debby
- Miles Davis — So What
- Chet Baker — My Funny Valentine
