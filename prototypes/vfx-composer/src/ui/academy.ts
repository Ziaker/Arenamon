import type {VfxProject} from '../core/types';
import type {UiPreferenceStorage, TutorialSessionRef} from './preferences';

export interface StepValidation {ok: boolean; message: string; focusCommandId?: string}
export interface TutorialStep {id: string; title: string; instruction: string; commandId?: string; suggested?: string; validate(project: Readonly<VfxProject>): StepValidation}
export interface TutorialLesson {id: string; title: string; summary: string; icon?: string; steps: readonly TutorialStep[]}
interface AcademyOptions {lessons: readonly TutorialLesson[]; storage?: UiPreferenceStorage; getProject(): Readonly<VfxProject>; autosaveSlot: string}
interface AcademyState {open: boolean; minimized: boolean; session: TutorialSessionRef | null}

const SESSION_KEY = 'arenamon.vfx.academy.v1';
export const ACADEMY_PLACEHOLDER_LESSONS: readonly TutorialLesson[] = [
  {id: 'magic-sphere', title: 'Esfera mágica explosiva', summary: 'Contato, deformação, explosão e disparo', icon: '◉', steps: [{id: 'prepare', title: 'Preparar projeto', instruction: 'Crie ou carregue um projeto para começar.', validate: project => ({ok: Boolean(project.projectId), message: 'Projeto pronto para a aula.'})}]},
  {id: 'energy-slash', title: 'Corte de energia', summary: 'Traço, ribbon, brilho e faíscas', icon: '╱', steps: [{id: 'prepare', title: 'Preparar projeto', instruction: 'Abra o espaço de desenho.', validate: project => ({ok: Boolean(project.projectId), message: 'Projeto pronto para a aula.'})}]},
  {id: 'arcane-circle', title: 'Círculo arcano', summary: 'Carga, emissão e erupção ritual', icon: '✣', steps: [{id: 'prepare', title: 'Preparar projeto', instruction: 'Abra o espaço de materiais.', validate: project => ({ok: Boolean(project.projectId), message: 'Projeto pronto para a aula.'})}]},
];
export class AcademyController {
  readonly lessons: readonly TutorialLesson[];
  private current: AcademyState = {open: false, minimized: false, session: null};
  constructor(private readonly options: AcademyOptions) {this.lessons = options.lessons;}
  get state(): Readonly<AcademyState> {return structuredClone(this.current);}
  private persist(): void {try {this.options.storage?.setItem(SESSION_KEY, JSON.stringify(this.current.session));} catch { /* sessão continua em memória */ }}
  start(lessonId: string, mode: 'restart' | 'current-project' = 'current-project'): void {
    const lesson = this.lessons.find(item => item.id === lessonId); if (!lesson) throw new Error(`Aula desconhecida: ${lessonId}`);
    const project = this.options.getProject();
    this.current = {open: true, minimized: false, session: {lessonId, stepId: lesson.steps[0]?.id ?? '', projectId: project.projectId, autosaveSlot: this.options.autosaveSlot}};
    void mode;
    this.persist();
  }
  minimize(): void {if (this.current.session) this.current = {...this.current, open: false, minimized: true};}
  close(): void {this.current = {open: false, minimized: false, session: null}; this.persist();}
  resume(): {status: 'resumed' | 'stale' | 'empty'} {
    let session = this.current.session;
    if (!session) try {session = JSON.parse(this.options.storage?.getItem(SESSION_KEY) ?? 'null') as TutorialSessionRef | null;} catch {session = null;}
    if (!session) return {status: 'empty'};
    const project = this.options.getProject();
    const validLesson = this.lessons.some(lesson => lesson.id === session!.lessonId && lesson.steps.some(step => step.id === session!.stepId));
    if (!validLesson || session.projectId !== project.projectId || session.autosaveSlot !== this.options.autosaveSlot) return {status: 'stale'};
    this.current = {open: true, minimized: false, session}; return {status: 'resumed'};
  }
  recoveryChoices(): Array<'restart' | 'current-project'> {return ['restart', 'current-project'];}
  validateCurrentStep(): StepValidation {
    const step = this.activeStep(); return step ? step.validate(this.options.getProject()) : {ok: false, message: 'Nenhuma etapa ativa'};
  }
  activeLesson(): TutorialLesson | null {return this.lessons.find(lesson => lesson.id === this.current.session?.lessonId) ?? null;}
  activeStep(): TutorialStep | null {return this.activeLesson()?.steps.find(step => step.id === this.current.session?.stepId) ?? null;}
  next(): void {
    const lesson = this.activeLesson(); if (!lesson || !this.current.session) return;
    const index = lesson.steps.findIndex(step => step.id === this.current.session!.stepId);
    const next = lesson.steps[Math.min(lesson.steps.length - 1, index + 1)];
    this.current.session = {...this.current.session, stepId: next.id}; this.persist();
  }
}

const safe = (value: string): string => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function mountAcademy(root: HTMLElement, controller: AcademyController): void {
  const lessonsRoot = root.querySelector<HTMLElement>('#academy-lessons') ?? root;
  const drawer = document.createElement('aside'); drawer.id = 'academy-drawer'; drawer.hidden = true; drawer.setAttribute('aria-label', 'Guia da Academia VFX');
  const chip = document.createElement('button'); chip.id = 'academy-resume'; chip.hidden = true; chip.textContent = 'Retomar aula';
  root.after(drawer, chip);
  const renderCatalog = (): void => {lessonsRoot.innerHTML = controller.lessons.map(lesson => `<button class="academy-card" data-lesson="${safe(lesson.id)}"><span>${safe(lesson.icon ?? '✦')}</span><strong>${safe(lesson.title)}</strong><small>${safe(lesson.summary)}</small><em>${lesson.steps.length} etapas</em></button>`).join('');};
  const renderDrawer = (): void => {
    const lesson = controller.activeLesson(), step = controller.activeStep(); if (!lesson || !step) {drawer.hidden = true; return;}
    const index = lesson.steps.findIndex(item => item.id === step.id), validation = controller.validateCurrentStep();
    drawer.hidden = false; chip.hidden = true;
    drawer.innerHTML = `<header><span>Aula ${index + 1}/${lesson.steps.length}</span><button data-academy-minimize aria-label="Minimizar tutorial">—</button><button data-academy-close aria-label="Fechar tutorial">×</button></header><div class="academy-progress"><i style="width:${(index + 1) / lesson.steps.length * 100}%"></i></div><strong>${safe(lesson.title)}</strong><h2>${safe(step.title)}</h2><p>${safe(step.instruction)}</p>${step.suggested ? `<small>${safe(step.suggested)}</small>` : ''}<div class="academy-validation" data-ok="${validation.ok}">${safe(validation.message)}</div><button data-academy-check>Verificar etapa</button><button data-academy-next ${validation.ok ? '' : 'disabled'}>${index === lesson.steps.length - 1 ? 'Concluir' : 'Próxima etapa'}</button>`;
  };
  renderCatalog();
  lessonsRoot.onclick = event => {const id = (event.target as HTMLElement).closest<HTMLElement>('[data-lesson]')?.dataset.lesson; if (id) {controller.start(id); renderDrawer();}};
  drawer.onclick = event => {const target = event.target as HTMLElement; if (target.closest('[data-academy-minimize]')) {controller.minimize(); drawer.hidden = true; chip.hidden = false;} else if (target.closest('[data-academy-close]')) {controller.close(); drawer.hidden = true;} else if (target.closest('[data-academy-check]')) renderDrawer(); else if (target.closest('[data-academy-next]')) {controller.next(); renderDrawer();}};
  chip.onclick = () => {controller.resume(); renderDrawer();};
}
