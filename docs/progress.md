# Tolmach — Прогресс разработки

## Этап 0 — Инициализация

- [x] Инициализация проекта: pnpm, tsconfig (strict), ESLint, Prettier
- [x] `.claude/CLAUDE.md`, `docs/progress.md`, `.env.example`
- [x] Установка зависимостей

## Этап 1 — Скелет (MVP)

- [x] Shared: Result<T,E>, Error hierarchy, Types
- [x] Infrastructure: Logger, ProcessRunner, FilesystemManager
- [x] Video: VideoMetadata, VideoProviderRegistry, YouTubeProvider
- [x] Transcription: TranscriptionResult, WhisperOutputParser, HallucinationFilter, WhisperTranscriber
- [x] CLI: PipelineEvent, ProgressDisplay, TranscribeCommand, Entry point
- [x] Unit-тесты этапа 1 (91 тест)

## Этап 2 — LLM

- [x] LlmResponse, LlmProvider interface, MockProvider
- [x] ClaudeAgentProvider через Claude Agent SDK (@anthropic-ai/claude-agent-sdk)
- [x] LlmRouter
- [x] VideoReportPrompt (первый шаблон), PromptContext, PromptTemplate
- [x] PipelineOrchestrator — связка всех этапов, PipelineReport
- [x] Обновление CLI: --no-llm, --llm-provider, полный pipeline
- [x] Unit-тесты этапа 2 (42 новых, итого 133)

## Этап 3 — Полировка

- [ ] Кэширование транскрипций
- [ ] ConfigManager (JSON + .env + CLI merge)
- [ ] Проверка системных зависимостей при старте
- [ ] Команда `tolmach config`
- [ ] README.md
- [ ] npm bin → глобальный алиас `tolmach`
- [ ] Финальные тесты, все проходят

## Лог изменений

| Дата | Этап | Что сделано | Тесты |
|------|------|-------------|-------|
| 2026-02-17 | Этап 0 | Инициализация: pnpm, tsconfig, eslint, prettier, vitest, tsup, CLAUDE.md, progress.md | — |
| 2026-02-17 | Этап 1 | Shared, Infrastructure, Video, Transcription, CLI | 91 ✅ |
| 2026-02-17 | Этап 2 | LLM domain, Claude Agent SDK, LlmRouter, Prompts, PipelineOrchestrator, CLI update | 133 ✅ |
