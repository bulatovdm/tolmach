# Tolmach

CLI-утилита для транскрибации видео и генерации структурированных отчётов с помощью LLM.

Tolmach скачивает аудио из видео, транскрибирует его через Whisper и генерирует Markdown-отчёт через Claude — всё одной командой.

## Возможности

- **Скачивание аудио** — извлечение аудиодорожки из YouTube (shorts, live, embed, youtu.be)
- **Транскрибация** — локальная транскрибация через whisper-cpp (без отправки аудио в облако)
- **Генерация отчётов** — структурированные Markdown-отчёты через Claude Agent SDK
- **Кэширование** — повторная транскрибация одного видео берётся из кэша
- **Прогресс** — отображение прогресса скачивания и транскрибации в реальном времени
- **Конфигурация** — JSON-конфиг, переменные окружения, CLI-флаги с приоритетом

## Быстрый старт

### Установка (macOS)

```bash
git clone git@github.com:bulatovdm/tolmach.git
cd tolmach
pnpm setup
```

Скрипт `pnpm setup` автоматически установит все зависимости:
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — скачивание видео
- [ffmpeg](https://ffmpeg.org/) — конвертация аудио
- [whisper-cpp](https://github.com/ggerganov/whisper.cpp) — транскрибация (бинарник `whisper-cli`)
- [Deno](https://deno.com/) — JS-рантайм для yt-dlp
- GGML-модель `large-v3-turbo` (~1.6 GB) — модель Whisper
- Node.js >= 20, pnpm

После установки команда `tolmach` доступна глобально.

### Использование

```bash
# Полный пайплайн: скачивание → транскрибация → отчёт через Claude
tolmach "https://www.youtube.com/watch?v=VIDEO_ID"

# Только транскрибация (без LLM)
tolmach --no-llm "https://www.youtube.com/watch?v=VIDEO_ID"
```

Результат сохраняется в `~/.tolmach/reports/` — после завершения в терминале появляется кликабельная ссылка на файл.

## CLI

```
tolmach [url] [options]
```

### Опции

| Флаг | Описание | По умолчанию |
|------|----------|--------------|
| `-p, --provider <name>` | LLM-провайдер | `claude-agent` |
| `-m, --model <name>` | Модель Whisper | `large-v3-turbo` |
| `--llm-provider <name>` | LLM-провайдер (альтернатива `-p`) | `claude-agent` |
| `-o, --output <path>` | Директория для сохранения | `~/.tolmach/reports` |
| `-l, --lang <code>` | Язык транскрибации | `auto` |
| `--no-llm` | Только транскрибация, без генерации отчёта | — |

### Управление конфигурацией

```bash
tolmach config show          # Показать текущую конфигурацию
tolmach config set <key> <value>  # Установить значение
tolmach config path          # Путь к файлу конфигурации
```

## Конфигурация

Конфигурация загружается из трёх источников (по приоритету):
1. CLI-флаги (наивысший)
2. Переменные окружения (`.env`)
3. JSON-файл (`~/.tolmach/config.json`)

### Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `LLM_PROVIDER` | LLM-провайдер (`claude-agent`, `mock`) | `claude-agent` |
| `LLM_MODEL` | Модель LLM | `claude-sonnet-4-5-20250929` |
| `LLM_REPORT_LANGUAGE` | Язык отчёта (`ru`, `en`, `auto`) | `ru` |
| `WHISPER_MODEL` | Модель Whisper | `large-v3-turbo` |
| `WHISPER_LANGUAGE` | Язык транскрибации | `auto` |
| `WHISPER_MODEL_DIR` | Директория с GGML-моделями | `~/.tolmach/models` |
| `TOLMACH_OUTPUT_DIR` | Директория для отчётов | `~/.tolmach/reports` |
| `TOLMACH_CACHE_DIR` | Директория кэша | `~/.tolmach/cache` |

### JSON-конфиг

```json
{
  "llm": {
    "provider": "claude-agent",
    "reportLanguage": "ru",
    "maxTokens": 4096,
    "temperature": 0
  },
  "whisper": {
    "model": "large-v3-turbo",
    "language": "auto",
    "modelDir": "~/.tolmach/models"
  },
  "output": {
    "dir": "~/.tolmach/reports"
  },
  "cache": {
    "enabled": true,
    "dir": "~/.tolmach/cache"
  }
}
```

## Архитектура

Проект построен по принципу слоистой архитектуры: **CLI → Domain → Infrastructure**.

```
src/
├── cli/                    # Точка входа, команды, UI
│   ├── commands/           # Команды CLI (transcribe, config)
│   └── ui/                 # Прогресс-бар, отображение
├── domain/                 # Бизнес-логика
│   ├── video/              # Провайдеры видео (YouTube)
│   ├── transcription/      # Whisper, парсинг, фильтрация
│   ├── llm/                # LLM-роутер, провайдеры, промпты
│   └── pipeline/           # Оркестратор пайплайна
├── infrastructure/         # Внешние сервисы
│   ├── process.runner.ts   # Запуск процессов (yt-dlp, whisper)
│   ├── filesystem.manager.ts
│   ├── config.manager.ts
│   ├── cache.manager.ts
│   └── dependency.checker.ts
├── config/                 # Zod-схема конфигурации
└── shared/                 # Result<T,E>, ошибки, типы
```

### Паттерны

- **Strategy** — `VideoProviderRegistry` (провайдеры видео), `LlmRouter` (провайдеры LLM)
- **Pipeline** — `PipelineOrchestrator` последовательно выполняет этапы: Detect → Download → Transcribe → Report → Save
- **Result<T, E>** — все операции возвращают `Result` вместо throw/catch
- **Value Objects** — `VideoMetadata`, `TranscriptionResult`, `LlmResponse`, `PipelineReport` (immutable, валидация в конструкторе)
- **DI** — все зависимости инжектятся через конструктор

### Этапы пайплайна

1. **Detect** — определение провайдера видео по URL
2. **Download** — скачивание аудиодорожки (минимальное качество, WAV)
3. **Transcribe** — транскрибация через whisper-cli с фильтрацией галлюцинаций
4. **Report** — генерация структурированного отчёта через LLM
5. **Save** — сохранение Markdown-файла

### Фильтрация галлюцинаций

`HallucinationFilter` удаляет типичные артефакты транскрибации:
- Шаблонные фразы («thanks for watching», «subscribe» и т.д.)
- Описания звуков (текст в верхнем регистре)
- Повторяющиеся паттерны
- Символы чужих скриптов (CJK, арабский, греческий)

## Разработка

### Требования

- Node.js >= 20
- pnpm

### Команды

```bash
pnpm dev          # Запуск в dev-режиме
pnpm build        # Сборка (tsup → dist/)
pnpm test         # Тесты (Vitest, 161 тест)
pnpm test:watch   # Тесты в watch-режиме
pnpm lint         # ESLint
pnpm typecheck    # TypeScript strict check
pnpm format       # Prettier
pnpm setup        # Установка системных зависимостей
```

### Стек

- **TypeScript** — strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **tsup** — сборка в ESM
- **Vitest** — тестирование
- **Zod v4** — валидация конфигурации
- **Commander** — CLI
- **execa** — запуск процессов
- **ora** + **chalk** — терминальный UI

### Структура тестов

Каждый доменный класс покрыт unit-тестами. Внешние зависимости (yt-dlp, whisper, Claude SDK) мокаются.

```
src/**/*.test.ts     # 20 файлов, 161 тест
```

## Лицензия

MIT
