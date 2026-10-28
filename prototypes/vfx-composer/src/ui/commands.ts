import type {IconName} from './icons';

export interface CommandContext {selectedId?: string | null; [key: string]: unknown}
export interface ComposerCommand {id: string; label: string; icon: IconName; shortcut?: string; isAvailable(context: CommandContext): boolean; unavailableReason?(context: CommandContext): string; execute(context: CommandContext): void}
export interface CommandResult {command: ComposerCommand; available: boolean; reason: string}

export class CommandRegistry {
  constructor(public readonly commands: ComposerCommand[]) {}
  search(query: string, context: CommandContext): CommandResult[] {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return this.commands.filter(command => !normalized || `${command.label} ${command.id} ${command.shortcut ?? ''}`.toLocaleLowerCase('pt-BR').includes(normalized)).map(command => {
      const available = command.isAvailable(context);
      return {command, available, reason: available ? '' : command.unavailableReason?.(context) ?? 'Indisponível neste contexto'};
    });
  }
}

export function mountCommandPalette(registry: CommandRegistry, context: () => CommandContext): void {
  document.body.insertAdjacentHTML('beforeend', `<dialog id="command-palette" hidden aria-label="Busca de comandos"><div class="command-head"><input id="command-search" type="search" placeholder="Buscar ferramenta, objeto ou ação" autocomplete="off"><kbd>Esc</kbd></div><div id="command-results"></div></dialog>`);
  const dialog = document.querySelector<HTMLDialogElement>('#command-palette')!;
  const input = document.querySelector<HTMLInputElement>('#command-search')!;
  const results = document.querySelector<HTMLElement>('#command-results')!;
  const close = (): void => { dialog.hidden = true; dialog.removeAttribute('open'); };
  const render = (): void => {
    results.replaceChildren(...registry.search(input.value, context()).map(result => {
      const button = document.createElement('button'); button.type = 'button'; button.disabled = !result.available;
      button.innerHTML = `<strong>${result.command.label}</strong><small>${result.available ? result.command.shortcut ?? '' : result.reason}</small>`;
      button.addEventListener('click', () => {result.command.execute(context()); close();}); return button;
    }));
  };
  input.addEventListener('input', render);
  window.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); dialog.hidden = false; dialog.setAttribute('open', ''); input.value = ''; render(); input.focus(); }
    if (event.key === 'Escape' && !dialog.hidden) close();
  });
}
