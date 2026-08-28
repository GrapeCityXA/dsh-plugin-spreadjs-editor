/** Module declaration for the css-as-text build plugin. */
declare module '*.css' {
  const content: string
  export default content
}
