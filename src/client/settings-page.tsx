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
 */
import { useEffect, useState, type ComponentType } from 'react'
import type { SpreadjsBridgeRegistry } from './bridge-registry.ts'
import type { BridgeSetting } from './bridge-setting.ts'
import { editorText } from './locales.ts'

/** One row, flattened for render: the title thunk is evaluated here, not stored. */
interface Row {
  readonly id: string
  readonly title: string
}

/** Build the `settings.section` body for this plugin. */
export function bridgeSettingsPage(
  registry: SpreadjsBridgeRegistry,
  setting: BridgeSetting,
): ComponentType<never> {
  return function BridgeSettings(): React.JSX.Element {
    const [rows, setRows] = useState<readonly Row[]>([])
    const [chosen, setChosen] = useState<string | undefined>(() => registry.selected())
    const [storage, setStorage] = useState<string | undefined>(() => setting.storageNote())

    useEffect(() => {
      const sync = (): void => {
        setRows(registry.list().map(entry => ({ id: entry.id, title: entry.title() })))
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

    if (rows.length === 0) {
      return (
        <div className="dsh-spreadjs-settings">
          <p className="dsh-spreadjs-settings-empty">
            No bridge is installed. A bridge is what lets the agent edit the workbook you have
            open; without one, this editor still opens and saves files.
          </p>
        </div>
      )
    }

    return (
      <div className="dsh-spreadjs-settings">
        <p className="dsh-spreadjs-settings-hint">{editorText('settings.hint')}</p>
        {/* Only after a write that did not land. Silently showing the choice as
            made is what let a never-persisted setting look like a working one
            until the next start, when it was simply gone. */}
        {storage === undefined ? null : (
          <p className="dsh-spreadjs-settings-warning" role="status">
            {storage === 'refused' ? editorText('settings.notSavedRefused') : editorText('settings.notSavedFailed')}
          </p>
        )}
        <ul className="dsh-spreadjs-settings-list">
          {rows.map(row => (
            <li key={row.id}>
              <button
                type="button"
                className="dsh-spreadjs-settings-option"
                aria-pressed={row.id === chosen}
                onClick={() => { setting.choose(row.id) }}
              >
                <span className="dsh-spreadjs-settings-option-title">{row.title}</span>
                {row.id === chosen
                  ? <span className="dsh-spreadjs-settings-option-tag">{editorText('settings.inUse')}</span>
                  : null}
              </button>
            </li>
          ))}
        </ul>
        {/* Nothing chosen is a real state — the user may want the editor alone —
            so it is offered rather than only being what you get by not choosing. */}
        <button
          type="button"
          className="dsh-spreadjs-settings-option dsh-spreadjs-settings-none"
          aria-pressed={chosen === undefined}
          onClick={() => { setting.choose(undefined) }}
        >
          <span className="dsh-spreadjs-settings-option-title">{editorText('settings.none')}</span>
          {chosen === undefined
            ? <span className="dsh-spreadjs-settings-option-tag">{editorText('settings.inUse')}</span>
            : null}
        </button>
      </div>
    )
  }
}
