# Tolmach

Скилл Claude Code для транскрибации видео и генерации структурированных отчётов.

Tolmach скачивает аудио из видео, транскрибирует его через Whisper и генерирует Markdown-отчёт — всё внутри интерактивной сессии Claude Code.

## Возможности

- **Скачивание аудио** — извлечение аудиодорожки из YouTube, Vimeo, локальных видео- и аудиофайлов
- **Транскрибация** — локальная транскрибация через whisper-cpp (без отправки аудио в облако)
- **Генерация отчётов** — структурированные Markdown-отчёты с адаптацией под длительность видео
- **Чистая транскрибация** — режим `--transcript`: полный причёсанный текст без выжимки
- **Интерактивность** — весь процесс виден в терминале, можно вмешаться на любом этапе

## Быстрый старт

### Установка (macOS)

```bash
git clone git@github.com:bulatovdm/tolmach.git
cd tolmach
./tools/setup.sh
```

Скрипт установит:
- [Claude Code](https://www.anthropic.com/claude-code) — через Homebrew
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — скачивание видео
- [ffmpeg](https://ffmpeg.org/) — конвертация аудио
- [whisper-cpp](https://github.com/ggerganov/whisper.cpp) — транскрибация (`whisper-cli`)
- GGML-модель `large-v3-turbo` (~1.6 GB)

Также добавит shell-функцию `tolmach` и скилл для Claude Code.

### Использование

```bash
# YouTube видео
tolmach "https://www.youtube.com/watch?v=VIDEO_ID"

# Локальный видеофайл
tolmach "/path/to/video.mp4"

# Локальный аудиофайл
tolmach "/path/to/audio.mp3"

# Чистая транскрибация вместо аналитического отчёта
tolmach --transcript "https://www.youtube.com/watch?v=VIDEO_ID"
```

Или напрямую в Claude Code:

```bash
claude "/tolmach https://www.youtube.com/watch?v=VIDEO_ID"
```

Отчёт сохраняется в `~/.tolmach/reports/`.

### Режимы

- **По умолчанию** — аналитическая выжимка: краткое содержание, ключевые темы, тезисы, цитаты и заключение с детализацией под длительность видео.
- **`--transcript`** — полный текст транскрипции без выжимки, очищенный от слов-паразитов, замиков («э-э», «ну», «как бы») и оговорок, с расставленной пунктуацией и абзацами. Смысл и формулировки говорящего сохраняются дословно. Файл сохраняется с суффиксом `-transcript`.

## Как это работает

```
tolmach <url>
    ↓
claude --model claude-sonnet-4-5 "/tolmach <url>"
    ↓
Claude Code запускает скилл:
  1. yt-dlp / ffmpeg → извлекает аудио в ~/.tolmach/tmp/
  2. whisper-cli → транскрибирует
  3. Claude → генерирует отчёт (или причёсанный транскрипт при --transcript)
  4. Сохраняет в ~/.tolmach/reports/
  5. Очищает временные файлы
```

### Структура отчёта

Уровень детализации адаптируется под длительность видео:

| Длительность | Содержание | Тезисы | Цитаты |
|---|---|---|---|
| До 15 мин | 3–5 предложений | краткий список | 3–5 |
| 15–45 мин | 5–8 предложений | 8–15 тезисов | 5–8 |
| Более 45 мин | 8–12 предложений | 15–25 тезисов | 8–12 |

## Структура проекта

```
tolmach/
├── .claude/
│   ├── CLAUDE.md                     # Инструкции для Claude Code
│   └── skills/tolmach/SKILL.md       # Скилл — ядро приложения
├── tools/
│   └── setup.sh                      # Установщик
├── docs/
│   ├── progress.md
│   └── roadmap.md
└── README.md
```

## Требования

- macOS
- [Claude Code](https://www.anthropic.com/claude-code) с подпиской Pro, Max, Team или Enterprise

## Лицензия

MIT
