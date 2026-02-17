# Tolmach — Техническое задание

> CLI-утилита для транскрибации видео и генерации отчётов с помощью LLM.

---

## 1. Концепция

**Tolmach** — персональный консольный инструмент, который принимает ссылку на видео, скачивает его, транскрибирует аудиодорожку через Whisper и отправляет транскрипцию в LLM для генерации структурированного отчёта.

Пайплайн:

```
Ссылка → Определение провайдера → Скачивание видео → Извлечение аудио
→ Транскрибация (Whisper) → LLM-обработка → Отчёт
```

Алиас для запуска: `tolmach`

---

## 2. Стек

- **Язык:** TypeScript (strict mode)
- **Рантайм:** Node.js 20+
- **Пакетный менеджер:** pnpm
- **Сборка:** tsx для запуска, tsup для билда
- **Линтинг:** ESLint + Prettier
- **Тестирование:** vitest

---

## 3. Референсные проекты

Перед началом разработки агент **обязан** изучить следующие проекты для понимания паттернов:

### 3.1. sheptun (Whisper-интеграция)

- **Путь:** найти локально или запросить у пользователя
- **Что изучить:** как реализована работа с Whisper (загрузка модели, транскрибация, обработка результатов), структура ООП-классов, паттерны типизации

### 3.2. techmed-inspector (LLM Router)

- **Путь:** найти локально или запросить у пользователя
- **Что изучить:** паттерн LLM Router — как реализована абстракция над разными LLM-провайдерами, интерфейсы, переключение между провайдерами

---

## 4. Архитектура

### 4.1. Диаграмма компонентов

```
┌─────────────────────────────────────────────────────────────────┐
│                          Tolmach CLI                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Application Layer                      │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ PipelineOrch│  │ProgressDisplay│  │  ConfigManager │  │  │
│  │  │  estrator   │  │              │  │                 │  │  │
│  │  └──────┬──────┘  └──────────────┘  └─────────────────┘  │  │
│  └─────────┼─────────────────────────────────────────────────┘  │
│            │                                                     │
│            ▼                                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      Domain Layer                         │  │
│  │                                                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │  │
│  │  │VideoProvider │  │ Transcriber  │  │  LlmRouter     │  │  │
│  │  │  Registry    │  │              │  │                 │  │  │
│  │  │              │  │              │  │  ┌────────────┐ │  │  │
│  │  │ ┌──────────┐ │  │  ┌────────┐  │  │  │ClaudeCode │ │  │  │
│  │  │ │YouTube   │ │  │  │Whisper │  │  │  │Provider   │ │  │  │
│  │  │ │Provider  │ │  │  │Adapter │  │  │  ├────────────┤ │  │  │
│  │  │ ├──────────┤ │  │  └────────┘  │  │  │OpenAI     │ │  │  │
│  │  │ │VK        │ │  │              │  │  │Provider   │ │  │  │
│  │  │ │Provider  │ │  │              │  │  ├────────────┤ │  │  │
│  │  │ ├──────────┤ │  │              │  │  │Ollama     │ │  │  │
│  │  │ │Generic   │ │  │              │  │  │Provider   │ │  │  │
│  │  │ │Provider  │ │  │              │  │  └────────────┘ │  │  │
│  │  │ └──────────┘ │  │              │  │                 │  │  │
│  │  └──────────────┘  └──────────────┘  └────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Infrastructure Layer                    │  │
│  │                                                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │  │
│  │  │ FileSystem   │  │ ProcessRunner│  │  Logger        │  │  │
│  │  │ Manager      │  │              │  │                 │  │  │
│  │  └──────────────┘  └──────────────┘  └────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2. Структура проекта

```
tolmach/
├── .claude/
│   └── CLAUDE.md                     # Инструкции для AI-агента
│
├── docs/
│   └── progress.md                   # Трекинг прогресса разработки
│
├── src/
│   ├── cli/
│   │   ├── index.ts                  # Точка входа CLI
│   │   ├── commands/
│   │   │   └── transcribe.command.ts # Основная команда
│   │   └── ui/
│   │       └── progress.display.ts   # Визуализация прогресса в консоли
│   │
│   ├── domain/
│   │   ├── video/
│   │   │   ├── video-provider.interface.ts
│   │   │   ├── video-provider.registry.ts
│   │   │   ├── video-metadata.ts           # Value Object
│   │   │   └── providers/
│   │   │       └── youtube.provider.ts
│   │   │
│   │   ├── transcription/
│   │   │   ├── transcriber.interface.ts
│   │   │   ├── transcription-result.ts     # Value Object
│   │   │   └── whisper.transcriber.ts
│   │   │
│   │   ├── llm/
│   │   │   ├── llm-provider.interface.ts
│   │   │   ├── llm-router.ts
│   │   │   ├── llm-response.ts             # Value Object
│   │   │   ├── prompts/
│   │   │   │   ├── prompt-template.interface.ts
│   │   │   │   └── video-report.prompt.ts
│   │   │   └── providers/
│   │   │       ├── claude-code.provider.ts
│   │   │       ├── openai.provider.ts
│   │   │       └── ollama.provider.ts
│   │   │
│   │   └── pipeline/
│   │       ├── pipeline.orchestrator.ts
│   │       ├── pipeline-stage.interface.ts
│   │       └── pipeline-event.ts           # Typed events
│   │
│   ├── infrastructure/
│   │   ├── filesystem.manager.ts
│   │   ├── process.runner.ts
│   │   ├── logger.ts
│   │   └── config.manager.ts
│   │
│   └── shared/
│       ├── types.ts
│       ├── errors.ts
│       └── result.ts                       # Result<T, E> type
│
├── config/
│   └── default.config.ts
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── .prettierrc
├── .env.example
└── README.md
```

---

## 5. Функциональные требования

### 5.1. CLI-интерфейс

| ID | Требование |
|----|------------|
| F-001 | Запуск через алиас `tolmach` |
| F-002 | При запуске без аргументов — интерактивный режим: запрос ссылки |
| F-003 | Поддержка аргумента `tolmach <url>` для быстрого запуска |
| F-004 | Флаг `--provider` / `-p` для выбора LLM-провайдера |
| F-005 | Флаг `--model` / `-m` для выбора модели |
| F-006 | Флаг `--output` / `-o` для указания пути выходного файла |
| F-007 | Флаг `--lang` / `-l` для языка транскрибации (по умолчанию: auto) |
| F-008 | Команда `tolmach config` для управления конфигурацией |

### 5.2. Визуализация прогресса

| ID | Требование |
|----|------------|
| F-010 | Отображение текущего этапа пайплайна с иконками/символами |
| F-011 | Спиннер на активном этапе |
| F-012 | Процент завершения, где это возможно (скачивание, транскрибация) |
| F-013 | Время выполнения каждого этапа |
| F-014 | Финальный отчёт: общее время, размер видео, длительность аудио |

Пример вывода в консоли:

```
🔍 Определение провайдера... YouTube ✓
📥 Скачивание видео........  45% ━━━━━━━━━░░░░░░░░░░░  128MB/284MB
🎙  Транскрибация..........  ████████████████████  100% (12:34)  ✓  [1m 23s]
🤖 Генерация отчёта........  ⠋
📄 Отчёт сохранён: ./reports/video-title-2026-02-17.md  ✓

Итого: 2m 45s | Видео: 12:34 | Модель: claude-sonnet-4-20250514
```

### 5.3. Провайдеры видео

| ID | Требование |
|----|------------|
| F-020 | Автоопределение провайдера по URL (паттерн-матчинг) |
| F-021 | YouTube-провайдер (первый и основной) — через yt-dlp |
| F-022 | Скачивание только аудиодорожки (без видео, экономия трафика) |
| F-023 | Извлечение метаданных: заголовок, автор, длительность, описание |
| F-024 | Архитектура расширяема для будущих провайдеров (VK, RuTube и др.) |
| F-025 | Провайдеры реализуют единый интерфейс `VideoProvider` |

### 5.4. Транскрибация

| ID | Требование |
|----|------------|
| F-030 | Транскрибация через Whisper (whisper.cpp или openai-whisper) |
| F-031 | Модель по умолчанию: `large-v3-turbo` |
| F-032 | Автоопределение языка с возможностью принудительной установки |
| F-033 | Вывод с таймкодами (для возможной навигации в будущем) |
| F-034 | Сохранение сырой транскрипции в файл (для кэширования / отладки) |
| F-035 | Если транскрипция для данного URL уже существует — использовать кэш |

### 5.5. LLM Router

| ID | Требование |
|----|------------|
| F-040 | Роутер — единая точка входа для работы с любым LLM |
| F-041 | Первый провайдер: Claude Code SDK (claude_code_sdk / @anthropic-ai/claude-code) |
| F-042 | Работа через подписку Max (OAuth, без API-ключа) |
| F-043 | Интерфейс `LlmProvider` с методом `complete(prompt, options)` |
| F-044 | Конфигурация провайдера через `.env` и CLI-флаги |
| F-045 | Архитектура расширяема: OpenAI API, Ollama и др. в будущем |

### 5.6. Сценарии обработки (Prompts)

| ID | Требование |
|----|------------|
| F-050 | Первый сценарий: «Отчёт о видео» — структурированная выжимка |
| F-051 | Промпт включает метаданные видео (заголовок, автор, длительность) |
| F-052 | Результат содержит: основная тема, ключевые тезисы, выводы, рекомендации |
| F-053 | Шаблоны промптов вынесены в отдельные файлы |
| F-054 | Архитектура расширяема: новые сценарии добавляются без изменения ядра |

### 5.7. Выходные данные

| ID | Требование |
|----|------------|
| F-060 | Результат сохраняется в Markdown-файл |
| F-061 | Имя файла: `{video-title}-{date}.md` (slug из заголовка) |
| F-062 | Директория по умолчанию: `~/.tolmach/reports/` |
| F-063 | Файл содержит: метаданные видео + отчёт LLM |
| F-064 | Вывод отчёта в консоль после завершения |

---

## 6. Нефункциональные требования

### 6.1. Архитектура и код

| ID | Требование |
|----|------------|
| NF-001 | Строгая типизация: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` в tsconfig |
| NF-002 | Принципы SOLID — каждый класс/модуль следует всем пяти принципам |
| NF-003 | Принцип DRY — никакого дублирования логики |
| NF-004 | Максимально твёрдый ООП: абстрактные классы, интерфейсы, инкапсуляция, полиморфизм |
| NF-005 | Без комментариев — код самодокументируемый |
| NF-006 | Говорящие имена переменных, методов, классов |
| NF-007 | Без глубокой вложенности: early return, guard clauses |
| NF-008 | Value Objects для данных (VideoMetadata, TranscriptionResult и др.) — immutable, с валидацией в конструкторе |
| NF-009 | Result type для обработки ошибок (без try/catch где возможно) |
| NF-010 | Dependency Injection через конструктор |
| NF-011 | Модификаторы доступа: `private`, `readonly` по умолчанию, `public` — только осознанно |
| NF-012 | Все методы и свойства строго типизированы — никаких `any`, `unknown` только в обоснованных случаях |
| NF-013 | Enum через `as const` объекты или union types, не через `enum` |

### 6.2. Тестирование

| ID | Требование |
|----|------------|
| NF-020 | Каждый класс домена **обязан** иметь unit-тесты |
| NF-021 | Тесты пишутся **параллельно с кодом**, не после |
| NF-022 | Перед коммитом / переходом к следующему этапу — все тесты должны проходить |
| NF-023 | Тестовые файлы рядом с исходными: `*.test.ts` |
| NF-024 | Покрытие: pipeline, router, registry, providers, value objects |
| NF-025 | vitest как тест-раннер |
| NF-026 | Моки для внешних зависимостей (yt-dlp, whisper, Claude SDK) |

### 6.3. Инструменты качества

| ID | Требование |
|----|------------|
| NF-030 | ESLint с strict-конфигурацией |
| NF-031 | Prettier для форматирования |
| NF-032 | `pnpm test` — запуск всех тестов перед каждым этапом |

### 6.4. Конфигурация

| ID | Требование |
|----|------------|
| NF-040 | `.env` для секретов (API-ключи) |
| NF-041 | `~/.tolmach/config.json` для пользовательских настроек |
| NF-042 | Конфиг по умолчанию встроен в приложение |
| NF-043 | Приоритет: CLI-флаги → .env → config.json → defaults |

### 6.5. Документация и трекинг прогресса

| ID | Требование |
|----|------------|
| NF-050 | README.md с инструкциями по установке и использованию |
| NF-051 | `.claude/CLAUDE.md` — описание архитектуры и правил для AI-агентов (см. раздел 13) |
| NF-052 | `.env.example` с описанием переменных |
| NF-053 | `docs/progress.md` — файл трекинга прогресса, создаётся **при инициализации проекта** (см. раздел 12) |
| NF-054 | Агент **обязан** обновлять `docs/progress.md` после завершения каждого этапа/подзадачи |

---

## 7. Интерфейсы (ключевые контракты)

```typescript
interface VideoProvider {
  readonly name: string;
  canHandle(url: string): boolean;
  download(url: string, outputDir: string): Promise<Result<DownloadedVideo, VideoError>>;
  extractMetadata(url: string): Promise<Result<VideoMetadata, VideoError>>;
}

interface Transcriber {
  transcribe(audioPath: string, options: TranscriptionOptions): Promise<Result<TranscriptionResult, TranscriptionError>>;
}

interface LlmProvider {
  readonly name: string;
  complete(prompt: string, options: LlmOptions): Promise<Result<LlmResponse, LlmError>>;
}

interface PromptTemplate {
  readonly name: string;
  readonly description: string;
  build(context: PromptContext): string;
}

interface PipelineStage<TInput, TOutput> {
  readonly name: string;
  execute(input: TInput, onProgress: ProgressCallback): Promise<Result<TOutput, PipelineError>>;
}
```

---

## 8. Конфигурация (.env.example)

```env
# LLM Provider: claude-code | openai | ollama
LLM_PROVIDER=claude-code

# Для OpenAI (будущее)
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o

# Для Ollama (будущее)
# OLLAMA_HOST=http://localhost:11434
# OLLAMA_MODEL=llama3

# Whisper
WHISPER_MODEL=large-v3-turbo
WHISPER_LANGUAGE=auto

# Пути
TOLMACH_OUTPUT_DIR=~/.tolmach/reports
TOLMACH_CACHE_DIR=~/.tolmach/cache
TOLMACH_TEMP_DIR=~/.tolmach/tmp
```

---

## 9. Зависимости

### Системные (должны быть установлены)

| Зависимость | Назначение |
|-------------|------------|
| `yt-dlp` | Скачивание видео/аудио |
| `ffmpeg` | Конвертация аудио |
| `whisper` / `whisper.cpp` | Транскрибация (взять паттерн из sheptun) |

### npm-пакеты

| Пакет | Назначение |
|-------|------------|
| `commander` / `yargs` | CLI-парсинг |
| `ora` | Спиннеры |
| `cli-progress` | Прогресс-бары |
| `chalk` | Цветной вывод |
| `dotenv` | Переменные окружения |
| `slugify` | Генерация slug из заголовков |
| `@anthropic-ai/claude-code` | Claude Code SDK |
| `zod` | Валидация конфигурации и данных |

---

## 10. Этапы реализации

### Этап 0 — Инициализация (перед написанием кода)

1. Создать структуру проекта: pnpm init, tsconfig (strict), ESLint, Prettier, vitest
2. Создать `.claude/CLAUDE.md` (см. раздел 13)
3. Создать `docs/progress.md` (см. раздел 12)
4. Создать `.env.example`
5. Изучить проекты sheptun и techmed-inspector

### Этап 1 — Скелет (MVP)

1. CLI с commander: команда `transcribe`, флаги
2. Базовая структура директорий и интерфейсы
3. VideoProviderRegistry + YouTubeProvider (yt-dlp)
4. WhisperTranscriber (вызов через child_process)
5. ProgressDisplay (ora + chalk)
6. **Unit-тесты для всех классов этапа 1**
7. **`pnpm test` — все тесты зелёные**
8. **Обновить `docs/progress.md`**

### Этап 2 — LLM

1. LlmProvider интерфейс
2. ClaudeCodeProvider через Claude Code SDK
3. LlmRouter
4. VideoReportPrompt (первый шаблон)
5. PipelineOrchestrator — связка всех этапов
6. **Unit-тесты для всех классов этапа 2**
7. **`pnpm test` — все тесты зелёные (включая этап 1)**
8. **Обновить `docs/progress.md`**

### Этап 3 — Полировка

1. Кэширование транскрипций
2. Обработка ошибок (Result type, graceful degradation)
3. ConfigManager (JSON + .env + CLI merge)
4. **Финальные тесты — полное покрытие, все зелёные**
5. README.md
6. npm bin → глобальный алиас `tolmach`
7. **Обновить `docs/progress.md` — финальный статус**

---

## 11. Команда для запуска разработки

```bash
claude "Реализуй проект tolmach по техническому заданию в файле tolmach-spec.md. Начни с Этапа 0 — создай структуру, .claude/CLAUDE.md и docs/progress.md. Затем изучи проекты sheptun и techmed-inspector — найди их на диске и разбери паттерны Whisper-интеграции и LLM Router. После этого приступай к Этапу 1. Тесты пишутся параллельно с кодом. Не переходи к следующему этапу, пока все тесты текущего не зелёные."
```

---

## 12. docs/progress.md (создать при инициализации)

```markdown
# Tolmach — Прогресс разработки

## Этап 1 — Скелет (MVP)

- [ ] Инициализация проекта: pnpm, tsconfig (strict), ESLint, Prettier
- [ ] CLI с commander: команда `transcribe`, флаги
- [ ] Базовая структура директорий и интерфейсы
- [ ] VideoProviderRegistry + YouTubeProvider (yt-dlp)
- [ ] WhisperTranscriber (вызов через child_process)
- [ ] ProgressDisplay (ora + chalk)
- [ ] Unit-тесты этапа 1 ✅

## Этап 2 — LLM

- [ ] LlmProvider интерфейс
- [ ] ClaudeCodeProvider через Claude Code SDK
- [ ] LlmRouter
- [ ] VideoReportPrompt (первый шаблон)
- [ ] PipelineOrchestrator — связка всех этапов
- [ ] Unit-тесты этапа 2 ✅

## Этап 3 — Полировка

- [ ] Кэширование транскрипций
- [ ] Обработка ошибок (Result type, graceful degradation)
- [ ] ConfigManager (JSON + .env + CLI merge)
- [ ] Финальные тесты, все проходят ✅
- [ ] README.md
- [ ] npm bin → глобальный алиас `tolmach`

## Лог изменений

| Дата | Этап | Что сделано | Тесты |
|------|------|-------------|-------|
| | | | |
```

---

## 13. .claude/CLAUDE.md (для AI-агента)

Включить в проект файл `.claude/CLAUDE.md` со следующим содержимым:

```markdown
# Tolmach

CLI-утилита для транскрибации видео и генерации отчётов.

## Стек
- TypeScript, Node.js 20+, pnpm
- Строгая типизация (strict: true, noUncheckedIndexedAccess, exactOptionalPropertyTypes)

## Архитектура
- Слоистая: CLI → Domain → Infrastructure
- VideoProvider Registry — паттерн Strategy для провайдеров видео
- LLM Router — паттерн Strategy для LLM-провайдеров
- Pipeline Orchestrator — последовательное выполнение этапов
- Result<T, E> вместо try/catch
- Максимально твёрдый ООП: абстрактные классы, интерфейсы, инкапсуляция

## Соглашения
- Без комментариев, говорящие имена
- SOLID, DRY, без глубокой вложенности
- Value Objects для данных (immutable, валидация в конструкторе)
- DI через конструктор
- Модификаторы: private/readonly по умолчанию
- Никаких `any` — строго типизировано

## Тестирование — ОБЯЗАТЕЛЬНО
- Каждый класс домена ОБЯЗАН иметь unit-тесты
- Тесты пишутся ПАРАЛЛЕЛЬНО с кодом, не после
- Перед переходом к следующему этапу — ВСЕ тесты должны проходить
- Запуск: `pnpm test`
- Моки для внешних зависимостей (yt-dlp, whisper, Claude SDK)
- НЕ ПЕРЕХОДИТЬ к следующему этапу, пока тесты текущего не зелёные

## Прогресс
- Обновлять `docs/progress.md` после каждого выполненного пункта
- Отмечать галочками выполненные задачи
- Заполнять лог изменений с датой и статусом тестов

## Команды
- `pnpm dev` — запуск в dev-режиме
- `pnpm build` — сборка
- `pnpm test` — тесты (ЗАПУСКАТЬ ПЕРЕД КАЖДЫМ ЭТАПОМ)
- `pnpm lint` — линтинг

## Ключевые файлы
- `src/cli/index.ts` — точка входа
- `src/domain/pipeline/pipeline.orchestrator.ts` — ядро
- `src/domain/llm/llm-router.ts` — роутер LLM
- `src/domain/video/video-provider.registry.ts` — реестр провайдеров
```
