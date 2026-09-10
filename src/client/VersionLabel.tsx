import sheetsPackage from '@grapecity-software/spread-sheets/package.json'
import designerPackage from '@grapecity-software/spread-sheets-designer/package.json'

export const bundledVersions = {
  spreadjs: sheetsPackage.version,
  designer: designerPackage.version,
}

export function VersionLabel() {
  return (
    <span className="dsh-spreadjs-version">SpreadJS {bundledVersions.spreadjs}</span>
  )
}
