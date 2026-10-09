/**
 * The Settings page where a user picks which bridge drives the workbook on
 * screen.
 *
 * Registered into `settings.section`, which is a `list` slot any package can
 * register into — unlike adding a page beside the plugin list, which is the
 * host's own surface and out of a third-party plugin's reach.
 *
 * The component takes the roster and the chooser as closed-over arguments rather
 * than through the slot's `inject` face. The first-party idiom for that face is a
 * snapshot store from `@deepseek-ai/dsh-client-store`, and pulling in a second
 * seed module for one list would put the whole browser bundle one missing seed
 * away from not loading at all. React state plus the registry's own
 * `subscribe` is the same reactivity with nothing new to resolve.
 *
 * The control is a RADIO GROUP, which is what "one of these, or none" is: the
 * group is a single tab stop, the arrows move within it, and the chosen row
 * carries `aria-checked`. It was buttons with `aria-pressed` at first, which
 * says "this button is currently pressed" — a per-button toggle, the wrong claim
 * about a choice that excludes the others. The harness draws its own one-of-N
 * lists the same way (`role="radiogroup"` over `role="radio"` buttons), so this
 * is also the platform's own idiom rather than a reading of the spec.
 */
import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { SpreadjsBridgeEntry, SpreadjsBridgeRegistry } from './bridge-registry.ts'
import type { BridgeSetting } from './bridge-setting.ts'
import { editorText } from './locales.ts'

/** One row of the group: a registered bridge, or the explicit "none". */
interface Option {
  /** `undefined` is the "none" row. It is a real answer, not the absence of one. */
  readonly id: string | undefined
  readonly title: string
}

/** Build the `settings.section` body for this plugin. */
export function bridgeSettingsPage(
  registry: SpreadjsBridgeRegistry,
  setting: BridgeSetting,
): ComponentType<never> {
  return function BridgeSettings(): React.JSX.Element {
    const [roster, setRoster] = useState<readonly SpreadjsBridgeEntry[]>(() => registry.list())
    const [chosen, setChosen] = useState<string | undefined>(() => registry.selected())
    const [storage, setStorage] = useState<string | undefined>(() => setting.storageNote())
    /** The rows, so arrow-key movement can focus one without a DOM query. */
    const rows = useRef<Array<HTMLButtonElement | null>>([])

    useEffect(() => {
      const sync = (): void => {
        setRoster(registry.list())
        setChosen(registry.selected())
        // Read on every pass: the note arrives after the write settles, which is
        // later than the click that started it.
        setStorage(setting.storageNote())
      }
      sync()
      const offRegistry = registry.subscribe(sync)
      const offSetting = setting.subscribe(sync)
      return () => {
        offRegistry()
        offSetting()
      }
    }, [])

    // Composed per render rather than stored, so each entry's `title` thunk is
    // called now: a title may be localized by whoever registered it, and the
    // "none" row's own text follows the active language like the rest of the UI.
    //
    // Nothing chosen is a real state — the user may want the editor alone — so
    // it is offered rather than only being what you get by not choosing.
    const options: readonly Option[] = [
      ...roster.map(entry => ({ id: entry.id as string | undefined, title: entry.title() })),
      { id: undefined, title: editorText('settings.none') },
    ]

    // Only the "none" row: no bridge is installed, so there is no choice to make.
    if (options.length === 1) {
      return (
        <div className="dsh-spreadjs-settings">
          <p className="dsh-spreadjs-settings-hint">{editorText('settings.empty')}</p>
        </div>
      )
    }

    const index = options.findIndex(option => option.id === chosen)

    /**
     * Move the selection `delta` rows, wrapping at both ends.
     *
     * Selection and focus travel together, as they do in a native radio group.
     * Focus is placed by POSITION, not by looking up the checked row in the DOM:
     * every row is mounted whether checked or not, while the `aria-checked` this
     * render will draw has not reached the DOM yet at this point.
     */
    const move = (delta: number): void => {
      const next = (index + delta + options.length) % options.length
      const option = options[next]
      if (option === undefined) return
      setting.choose(option.id)
      rows.current[next]?.focus()
    }

    const onKeyDown = (event: React.KeyboardEvent): void => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault()
        move(1)
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        move(-1)
      }
    }

    return (
      <div className="dsh-spreadjs-settings">
        <p className="dsh-spreadjs-settings-hint" id="dsh-spreadjs-bridge-hint">
          {editorText('settings.hint')}
        </p>
        {/* Only after a write that did not land. Silently showing the choice as
            made is what let a never-persisted setting look like a working one
            until the next start, when it was simply gone. */}
        {storage === undefined ? null : (
          <p className="dsh-spreadjs-settings-warning" role="status">
            {storage === 'refused' ? editorText('settings.notSavedRefused') : editorText('settings.notSavedFailed')}
          </p>
        )}
        <div
          className="dsh-spreadjs-settings-group"
          role="radiogroup"
          aria-labelledby="dsh-spreadjs-bridge-hint"
          onKeyDown={onKeyDown}
        >
          {options.map((option, position) => (
            <button
              key={option.id ?? 'none'}
              type="button"
              role="radio"
              aria-checked={option.id === chosen}
              // A roving tab stop: the group is one stop and the arrows move
              // inside it, which is what a radio group is expected to do.
              tabIndex={option.id === chosen ? 0 : -1}
              ref={element => { rows.current[position] = element }}
              className="dsh-spreadjs-settings-row"
              onClick={() => { setting.choose(option.id) }}
            >
              <span className="dsh-spreadjs-settings-row-title">{option.title}</span>
              {/* The tick says "selected", which is all this page knows. It used
                  to say "使用中 / In use", which claims the bridge is holding a
                  workbook right now — something the settings document cannot
                  tell us, since it records a choice, not an open panel. The mark
                  is a shape rather than a word, so it needs no translation
                  either. */}
              <span className="dsh-spreadjs-settings-row-mark" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    )
  }
}
