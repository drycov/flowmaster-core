declare module "node-forge" {
  // Minimal surface used by EDS / IIN parsing; full types are not shipped with node-forge.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const forge: any;
  export default forge;
}
