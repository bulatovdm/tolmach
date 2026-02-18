import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import chalk from "chalk";

export function updateCommand(): void {
  const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

  console.log(chalk.yellow("Обновление Tolmach..."));
  console.log(chalk.dim(`Директория проекта: ${projectDir}\n`));

  const steps: Array<{ label: string; cmd: string }> = [
    { label: "Получение обновлений из репозитория", cmd: "git pull" },
    { label: "Установка зависимостей", cmd: "pnpm install" },
    { label: "Сборка", cmd: "pnpm build" },
    { label: "Обновление глобальной команды", cmd: "pnpm link --global" },
  ];

  for (const step of steps) {
    process.stdout.write(`  ${step.label}... `);
    try {
      execSync(step.cmd, { cwd: projectDir, stdio: "pipe" });
      console.log(chalk.green("✓"));
    } catch (error) {
      console.log(chalk.red("✗"));
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\nОшибка: ${message}`));
      process.exitCode = 1;
      return;
    }
  }

  console.log(chalk.green("\n✓ Tolmach успешно обновлён"));
}
