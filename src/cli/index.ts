#!/usr/bin/env node

import { Command } from "commander";
import { transcribeCommand } from "./commands/transcribe.command.js";
import { configShowCommand, configSetCommand, configPathCommand } from "./commands/config.command.js";

const program = new Command();

program
  .name("tolmach")
  .description("CLI-утилита для транскрибации видео и генерации отчётов")
  .version("0.1.0");

program
  .argument("[url]", "URL видео для транскрибации")
  .option("-p, --provider <provider>", "LLM-провайдер (claude-agent, mock)")
  .option("-m, --model <model>", "Модель для Whisper-транскрибации")
  .option("--llm-provider <provider>", "LLM-провайдер для генерации отчёта")
  .option("-o, --output <path>", "Путь для выходного файла")
  .option("-l, --lang <language>", "Язык транскрибации (по умолчанию: auto)")
  .option("--no-llm", "Только транскрибация, без LLM")
  .action(async (url: string | undefined, options: Record<string, string | boolean | undefined>) => {
    if (!url) {
      program.help();
      return;
    }

    await transcribeCommand(url, {
      model: options["model"] as string | undefined,
      output: options["output"] as string | undefined,
      lang: options["lang"] as string | undefined,
      llmProvider: (options["llmProvider"] ?? options["provider"]) as string | undefined,
      noLlm: options["llm"] === false,
    });
  });

const configCmd = program
  .command("config")
  .description("Управление конфигурацией");

configCmd
  .command("show")
  .description("Показать текущую конфигурацию")
  .action(async () => {
    await configShowCommand();
  });

configCmd
  .command("set <key> <value>")
  .description('Установить параметр (например: tolmach config set llm.provider mock)')
  .action(async (key: string, value: string) => {
    await configSetCommand(key, value);
  });

configCmd
  .command("path")
  .description("Показать путь к файлу конфигурации")
  .action(() => {
    configPathCommand();
  });

program.parse();
