# Tolmach

Скилл Claude Code для транскрибации видео и генерации отчётов.

## Архитектура
- Claude Code Skill (`.claude/skills/tolmach/SKILL.md` — проектный скилл)
- Shell-функция `tolmach()` как точка входа
- Внешние зависимости: yt-dlp, ffmpeg, whisper-cli, Claude Code

## Использование
- `tolmach <url-или-путь>` — запускает интерактивную сессию Claude Code со скиллом
- `claude "/tolmach <url>"` — то же самое напрямую

## Установка
- `./tools/setup.sh` — полная установка (зависимости + скилл + shell-функция)
- `./tools/setup.sh deps` — только зависимости
- `./tools/setup.sh check` — проверка зависимостей

## Ключевые файлы
- `.claude/skills/tolmach/SKILL.md` — скилл с инструкциями для Claude Code
- `tools/setup.sh` — установщик

## Прогресс
- Обновлять `docs/progress.md` после каждого выполненного пункта

## README
- После любых изменений в функциональности — проверить, требуется ли обновление `README.md`
- Перед обновлением README — получить подтверждение пользователя
