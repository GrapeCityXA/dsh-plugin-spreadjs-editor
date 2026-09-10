import sheetsPackage from '@grapecity-software/spread-sheets/package.json'
import designerPackage from '@grapecity-software/spread-sheets-designer/package.json'

export const bundledVersions = {
  spreadjs: sheetsPackage.version,
  designer: designerPackage.version,
}

export function CompatibilityNotice() {
  const chinese = typeof navigator !== 'undefined' && navigator.language.startsWith('zh')
  return (
    <aside className="dsh-spreadjs-compatibility" aria-label={chinese ? '文件兼容性' : 'File compatibility'}>
      <div className="dsh-spreadjs-versions">
        <span>SpreadJS {bundledVersions.spreadjs}</span>
        <span>Designer {bundledVersions.designer}</span>
      </div>
      <p>{chinese
        ? '保存后的文件可能无法在低版本 SpreadJS 中打开，或丢失不支持的功能。请保留原文件，另存副本；覆盖前确认目标版本兼容。'
        : 'Saved files may not open in older SpreadJS versions or may lose unsupported features. Keep the original and save a copy; check target-version compatibility before overwriting.'}</p>
    </aside>
  )
}
